// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package server

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/containerd/containerd/remotes"
	"github.com/containerd/containerd/remotes/docker"
	"github.com/docker/cli/cli/config/configfile"
	"github.com/gitpod-io/gitpod/common-go/baseserver"
	"github.com/gitpod-io/gitpod/common-go/experiments"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/watch"
	gitpodapi "github.com/gitpod-io/gitpod/gitpod-protocol"
	api "github.com/gitpod-io/gitpod/ide-service-api"
	"github.com/gitpod-io/gitpod/ide-service-api/config"
	"github.com/heptiolabs/healthcheck"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/sirupsen/logrus"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/health/grpc_health_v1"
)

// ResolverProvider provides new resolver
type ResolverProvider func() remotes.Resolver

type IDEServiceServer struct {
	config                         *config.ServiceConfiguration
	originIDEConfig                []byte
	parsedIDEConfigContent         string
	parsedCode1_85IDEConfigContent string
	ideConfig                      *config.IDEConfig
	code1_85IdeConfig              *config.IDEConfig
	ideConfigFileName              string
	experimentsClient              experiments.Client
	resolver                       ResolverProvider

	api.UnimplementedIDEServiceServer
}

func Start(logger *logrus.Entry, cfg *config.ServiceConfiguration) error {

	ctx := context.Background()
	logger.WithField("config", cfg).Info("Starting ide-service.")

	registry := prometheus.NewRegistry()
	health := healthcheck.NewHandler()

	srv, err := baseserver.New("ide-service",
		baseserver.WithLogger(logger),
		baseserver.WithConfig(cfg.Server),
		baseserver.WithMetricsRegistry(registry),
		baseserver.WithHealthHandler(health),
	)
	if err != nil {
		return fmt.Errorf("failed to initialize ide-service: %w", err)
	}
	var (
		dockerCfg   *configfile.ConfigFile
		dockerCfgMu sync.RWMutex
	)

	resolverProvider := func() remotes.Resolver {
		var resolverOpts docker.ResolverOptions

		dockerCfgMu.RLock()
		defer dockerCfgMu.RUnlock()
		if dockerCfg != nil {
			resolverOpts.Hosts = docker.ConfigureDefaultRegistries(
				docker.WithAuthorizer(authorizerFromDockerConfig(dockerCfg)),
			)
		}

		return docker.NewResolver(resolverOpts)
	}
	if cfg.DockerCfg != "" {
		dockerCfg = loadDockerCfg(cfg.DockerCfg)
		err = watch.File(ctx, cfg.DockerCfg, func() {
			dockerCfgMu.Lock()
			defer dockerCfgMu.Unlock()

			dockerCfg = loadDockerCfg(cfg.DockerCfg)
		})
		if err != nil {
			log.WithError(err).Fatal("cannot start watch of Docker auth configuration file")
		}
	}

	s := New(cfg, resolverProvider)
	go s.watchIDEConfig(ctx)
	go s.scheduleUpdate(ctx)
	s.register(srv.GRPC())

	health.AddReadinessCheck("ide-service", func() error {
		if s.ideConfig == nil {
			return fmt.Errorf("ide config is not ready")
		}
		return nil
	})
	health.AddReadinessCheck("grpc-server", grpcProbe(*cfg.Server.Services.GRPC))

	if err := srv.ListenAndServe(); err != nil {
		return fmt.Errorf("failed to serve ide-service: %w", err)
	}

	return nil
}

func loadDockerCfg(fn string) *configfile.ConfigFile {
	if tproot := os.Getenv("TELEPRESENCE_ROOT"); tproot != "" {
		fn = filepath.Join(tproot, fn)
	}
	fr, err := os.OpenFile(fn, os.O_RDONLY, 0)
	if err != nil {
		log.WithError(err).Fatal("cannot read docker auth config")
	}

	dockerCfg := configfile.New(fn)
	err = dockerCfg.LoadFromReader(fr)
	fr.Close()
	if err != nil {
		log.WithError(err).Fatal("cannot read docker config")
	}
	log.WithField("fn", fn).Info("using authentication for backing registries")

	return dockerCfg
}

// FromDockerConfig turns docker client config into docker registry hosts
func authorizerFromDockerConfig(cfg *configfile.ConfigFile) docker.Authorizer {
	return docker.NewDockerAuthorizer(docker.WithAuthCreds(func(host string) (user, pass string, err error) {
		auth, err := cfg.GetAuthConfig(host)
		if err != nil {
			return
		}
		user = auth.Username
		pass = auth.Password
		return
	}))
}

func New(cfg *config.ServiceConfiguration, resolver ResolverProvider) *IDEServiceServer {
	fn, err := filepath.Abs(cfg.IDEConfigPath)
	if err != nil {
		log.WithField("path", cfg.IDEConfigPath).WithError(err).Fatal("cannot convert ide config path to abs path")
	}
	s := &IDEServiceServer{
		config:            cfg,
		ideConfigFileName: fn,
		experimentsClient: experiments.NewClient(),
		resolver:          resolver,
	}
	return s
}

func (s *IDEServiceServer) register(grpcServer *grpc.Server) {
	api.RegisterIDEServiceServer(grpcServer, s)
}

func (s *IDEServiceServer) GetConfig(ctx context.Context, req *api.GetConfigRequest) (*api.GetConfigResponse, error) {
	attributes := experiments.Attributes{
		UserID:    req.User.Id,
		UserEmail: req.User.GetEmail(),
	}

	// Check flag to enable vscode for older linux distros (distros that don't support glibc 2.28)
	enableVscodeForOlderLinuxDistros := s.experimentsClient.GetBoolValue(ctx, "enableVscodeForOlderLinuxDistros", false, attributes)

	if enableVscodeForOlderLinuxDistros {
		return &api.GetConfigResponse{
			Content: s.parsedCode1_85IDEConfigContent,
		}, nil
	}

	return &api.GetConfigResponse{
		Content: s.parsedIDEConfigContent,
	}, nil
}

func (s *IDEServiceServer) readIDEConfig(ctx context.Context, isInit bool) {
	ideConfigbuffer, err := os.ReadFile(s.ideConfigFileName)
	if err != nil {
		log.WithError(err).Warn("cannot read original ide config file")
		return
	}
	if originalIdeConfig, err := ParseConfig(ctx, s.resolver(), ideConfigbuffer); err != nil {
		if !isInit {
			log.WithError(err).Fatal("cannot parse original ide config")
		}
		log.WithError(err).Error("cannot parse original ide config")
		return
	} else {
		parsedConfig, err := json.Marshal(originalIdeConfig)
		if err != nil {
			log.WithError(err).Error("cannot marshal original ide config")
			return
		}

		// Precompute the config without code 1.85
		code1_85IdeOptions := originalIdeConfig.IdeOptions.Options
		ideOptions := make(map[string]config.IDEOption)
		for key, ide := range code1_85IdeOptions {
			if key != "code1_85" {
				ideOptions[key] = ide
			}
		}

		ideConfig := &config.IDEConfig{
			SupervisorImage: originalIdeConfig.SupervisorImage,
			IdeOptions: config.IDEOptions{
				Options:           ideOptions,
				DefaultIde:        originalIdeConfig.IdeOptions.DefaultIde,
				DefaultDesktopIde: originalIdeConfig.IdeOptions.DefaultDesktopIde,
				Clients:           originalIdeConfig.IdeOptions.Clients,
			},
		}

		parsedIdeConfig, err := json.Marshal(ideConfig)
		if err != nil {
			log.WithError(err).Error("cannot marshal ide config")
			return
		}

		s.parsedCode1_85IDEConfigContent = string(parsedConfig)
		s.code1_85IdeConfig = originalIdeConfig

		s.ideConfig = ideConfig
		s.parsedIDEConfigContent = string(parsedIdeConfig)

		s.originIDEConfig = ideConfigbuffer

		log.Info("ide config updated")
	}
}

func (s *IDEServiceServer) watchIDEConfig(ctx context.Context) {
	go s.readIDEConfig(ctx, true)

	// `watch.File` only watch for create and remove event
	// so with locally debugging, we cannot watch example ide config file change
	// but in k8s, configmap change will create/remove file to replace it
	if err := watch.File(ctx, s.ideConfigFileName, func() {
		s.readIDEConfig(ctx, false)
	}); err != nil {
		log.WithError(err).Fatal("cannot start watch of ide config file")
	}
}

func (s *IDEServiceServer) scheduleUpdate(ctx context.Context) {
	t := time.NewTicker(time.Hour * 1)
	for {
		select {
		case <-t.C:
			log.Info("schedule update config")
			s.readIDEConfig(ctx, false)
		case <-ctx.Done():
			t.Stop()
			return
		}
	}
}

func grpcProbe(cfg baseserver.ServerConfiguration) func() error {
	return func() error {
		creds := insecure.NewCredentials()

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		conn, err := grpc.DialContext(ctx, cfg.Address, grpc.WithTransportCredentials(creds))
		if err != nil {
			return err
		}
		defer conn.Close()

		client := grpc_health_v1.NewHealthClient(conn)
		check, err := client.Check(ctx, &grpc_health_v1.HealthCheckRequest{})
		if err != nil {
			return err
		}

		if check.Status == grpc_health_v1.HealthCheckResponse_SERVING {
			return nil
		}
		return fmt.Errorf("grpc service not ready")
	}
}

type IDESettings struct {
	DefaultIde        string            `json:"defaultIde,omitempty"`
	UseLatestVersion  bool              `json:"useLatestVersion,omitempty"`
	PreferToolbox     bool              `json:"preferToolbox,omitempty"`
	PinnedIDEversions map[string]string `json:"pinnedIDEversions,omitempty"`
}

type WorkspaceContext struct {
	Referrer    string `json:"referrer,omitempty"`
	ReferrerIde string `json:"referrerIde,omitempty"`
}

func (s *IDEServiceServer) resolveReferrerIDE(ideConfig *config.IDEConfig, wsCtx *WorkspaceContext, chosenIDEName string) (ideName string, ideOption *config.IDEOption) {
	if wsCtx == nil || wsCtx.Referrer == "" {
		return
	}

	client, ok := ideConfig.IdeOptions.Clients[wsCtx.Referrer]
	if !ok {
		return
	}

	getValidIDEOption := func(ideName string) (*config.IDEOption, bool) {
		optionToCheck, ok := ideConfig.IdeOptions.Options[ideName]
		if !ok {
			return nil, false
		}
		for _, ide := range client.DesktopIDEs {
			if ide == ideName {
				return &optionToCheck, true
			}
		}
		return nil, false
	}

	ideOption, ok = getValidIDEOption(wsCtx.ReferrerIde)
	if ok {
		ideName = wsCtx.ReferrerIde
		return
	}
	ideOption, ok = getValidIDEOption(chosenIDEName)
	if ok {
		ideName = chosenIDEName
		return
	}
	ideOption, ok = getValidIDEOption(client.DefaultDesktopIDE)
	if ok {
		ideName = client.DefaultDesktopIDE
		return
	}
	return
}

func (s *IDEServiceServer) ResolveWorkspaceConfig(ctx context.Context, req *api.ResolveWorkspaceConfigRequest) (resp *api.ResolveWorkspaceConfigResponse, err error) {
	log.WithField("req", req).Debug("receive ResolveWorkspaceConfig request")

	// make a copy for ref ideConfig, it's safe because we replace ref in update config
	ideConfig := s.code1_85IdeConfig

	defaultIdeOption, ok := ideConfig.IdeOptions.Options[ideConfig.IdeOptions.DefaultIde]
	if !ok {
		// I think it never happen, we have a check to make sure all DefaultIDE should be in Options
		log.WithError(err).WithField("defaultIDE", ideConfig.IdeOptions.DefaultIde).Error("IDE configuration corrupt, cannot found defaultIDE")
		return nil, fmt.Errorf("IDE configuration corrupt")
	}

	resp = &api.ResolveWorkspaceConfigResponse{
		SupervisorImage: ideConfig.SupervisorImage,
		WebImage:        defaultIdeOption.Image,
		IdeImageLayers:  defaultIdeOption.ImageLayers,
	}

	if os.Getenv("CONFIGCAT_SDK_KEY") != "" {
		resp.Envvars = append(resp.Envvars, &api.EnvironmentVariable{
			Name:  "GITPOD_CONFIGCAT_ENABLED",
			Value: "true",
		})
	}

	var wsConfig *gitpodapi.GitpodConfig

	if req.WorkspaceConfig != "" {
		if err := json.Unmarshal([]byte(req.WorkspaceConfig), &wsConfig); err != nil {
			log.WithError(err).WithField("workspaceConfig", req.WorkspaceConfig).Error("failed to parse workspace config")
		}
	}

	var ideSettings *IDESettings
	if req.IdeSettings != "" {
		if err := json.Unmarshal([]byte(req.IdeSettings), &ideSettings); err != nil {
			log.WithError(err).WithField("ideSetting", req.IdeSettings).Error("failed to parse ide settings")
		}
	}

	pinnedIDEversions := make(map[string]string)

	if ideSettings != nil {
		pinnedIDEversions = ideSettings.PinnedIDEversions
	}

	getUserIDEImage := func(ide string, useLatest bool) string {
		ideOption := ideConfig.IdeOptions.Options[ide]
		if useLatest && ideOption.LatestImage != "" {
			return ideOption.LatestImage
		}

		if version, ok := pinnedIDEversions[ide]; ok {
			if idx := slices.IndexFunc(ideOption.Versions, func(v config.IDEVersion) bool { return v.Version == version }); idx >= 0 {
				return ideOption.Versions[idx].Image
			}
		}

		return ideOption.Image
	}

	getUserImageLayers := func(ide string, useLatest bool) []string {
		ideOption := ideConfig.IdeOptions.Options[ide]
		if useLatest {
			return ideOption.LatestImageLayers
		}

		if version, ok := pinnedIDEversions[ide]; ok {
			if idx := slices.IndexFunc(ideOption.Versions, func(v config.IDEVersion) bool { return v.Version == version }); idx >= 0 {
				return ideOption.Versions[idx].ImageLayers
			}
		}

		return ideOption.ImageLayers
	}

	if req.Type == api.WorkspaceType_REGULAR {
		var wsContext *WorkspaceContext

		if req.Context != "" {
			if err := json.Unmarshal([]byte(req.Context), &wsContext); err != nil {
				log.WithError(err).WithField("context", req.Context).Error("failed to parse context")
			}
		}

		userIdeName := ""
		useLatest := false
		preferToolbox := false
		resultingIdeName := ideConfig.IdeOptions.DefaultIde
		chosenIDE := ideConfig.IdeOptions.Options[resultingIdeName]

		if ideSettings != nil {
			userIdeName = ideSettings.DefaultIde
			useLatest = ideSettings.UseLatestVersion
			preferToolbox = ideSettings.PreferToolbox
		}

		if preferToolbox {
			preferToolboxEnv := api.EnvironmentVariable{
				Name:  "GITPOD_PREFER_TOOLBOX",
				Value: "true",
			}
			debuggingEnv := api.EnvironmentVariable{
				Name:  "GITPOD_TOOLBOX_DEBUGGING",
				Value: s.experimentsClient.GetStringValue(ctx, "enable_experimental_jbtb_debugging", "", experiments.Attributes{UserID: req.User.Id}),
			}
			resp.Envvars = append(resp.Envvars, &preferToolboxEnv, &debuggingEnv)
		}

		if userIdeName != "" {
			if ide, ok := ideConfig.IdeOptions.Options[userIdeName]; ok {
				resultingIdeName = userIdeName
				chosenIDE = ide
				// TODO: Currently this variable reflects the IDE selected in
				// user's settings for backward compatibility but in the future
				// we want to make it represent the actual IDE.
				ideAlias := api.EnvironmentVariable{
					Name:  "GITPOD_IDE_ALIAS",
					Value: userIdeName,
				}
				resp.Envvars = append(resp.Envvars, &ideAlias)
			}
		}

		// we always need WebImage for when the user chooses a desktop ide
		resp.WebImage = getUserIDEImage(ideConfig.IdeOptions.DefaultIde, useLatest)
		resp.IdeImageLayers = getUserImageLayers(ideConfig.IdeOptions.DefaultIde, useLatest)

		var desktopImageLayer string
		var desktopUserImageLayers []string
		if chosenIDE.Type == config.IDETypeDesktop {
			desktopImageLayer = getUserIDEImage(resultingIdeName, useLatest)
			desktopUserImageLayers = getUserImageLayers(resultingIdeName, useLatest)
		} else {
			resp.WebImage = getUserIDEImage(resultingIdeName, useLatest)
			resp.IdeImageLayers = getUserImageLayers(resultingIdeName, useLatest)
		}

		// TODO (se) this should be handled on the surface (i.e. server or even dashboard) and not passed as a special workspace context down here.
		ideName, _ := s.resolveReferrerIDE(ideConfig, wsContext, userIdeName)
		if ideName != "" {
			resp.RefererIde = ideName
			resultingIdeName = ideName
			desktopImageLayer = getUserIDEImage(ideName, useLatest)
			desktopUserImageLayers = getUserImageLayers(ideName, useLatest)
		}

		if desktopImageLayer != "" {
			resp.IdeImageLayers = append(resp.IdeImageLayers, desktopImageLayer)
			resp.IdeImageLayers = append(resp.IdeImageLayers, desktopUserImageLayers...)
		}

		// we are returning the actually used ide name here, which might be different from the user's choice
		ideSettingsEncoded := new(bytes.Buffer)
		enc := json.NewEncoder(ideSettingsEncoded)
		enc.SetEscapeHTML(false)

		resultingIdeSettings := &IDESettings{
			DefaultIde:       resultingIdeName,
			UseLatestVersion: useLatest,
			PreferToolbox:    preferToolbox,
		}

		err = enc.Encode(resultingIdeSettings)
		if err != nil {
			log.WithError(err).Error("cannot marshal ideSettings")
		}

		resp.IdeSettings = ideSettingsEncoded.String()
	}

	// TODO figure out how to make it configurable on IDE level, not hardcoded here
	jbGW, ok := ideConfig.IdeOptions.Clients["jetbrains-gateway"]
	if req.Type == api.WorkspaceType_PREBUILD && ok {
		imageLayers := make(map[string]struct{})
		for _, alias := range jbGW.DesktopIDEs {
			if _, ok := ideConfig.IdeOptions.Options[alias]; !ok {
				continue
			}
			prebuilds := getPrebuilds(wsConfig, alias)
			if prebuilds != nil {
				if prebuilds.Version != "latest" && prebuilds.Version != "stable" && prebuilds.Version != "both" {
					continue
				}

				if prebuilds.Version != "latest" {
					layers := getUserImageLayers(alias, false)
					for _, layer := range layers {
						if _, ok := imageLayers[layer]; !ok {
							imageLayers[layer] = struct{}{}
							resp.IdeImageLayers = append(resp.IdeImageLayers, layer)
						}
					}
					resp.IdeImageLayers = append(resp.IdeImageLayers, getUserIDEImage(alias, false))
				}

				if prebuilds.Version != "stable" {
					layers := getUserImageLayers(alias, true)
					for _, layer := range layers {
						if _, ok := imageLayers[layer]; !ok {
							imageLayers[layer] = struct{}{}
							resp.IdeImageLayers = append(resp.IdeImageLayers, layer)
						}
					}
					resp.IdeImageLayers = append(resp.IdeImageLayers, getUserIDEImage(alias, true))
				}
			}
		}
	}

	return
}

func getPrebuilds(config *gitpodapi.GitpodConfig, alias string) *gitpodapi.Prebuilds {
	if config == nil || config.Jetbrains == nil {
		return nil
	}
	productConfig := getProductConfig(config, alias)
	if productConfig == nil {
		return nil
	}
	return productConfig.Prebuilds
}

func getProductConfig(config *gitpodapi.GitpodConfig, alias string) *gitpodapi.JetbrainsProduct {
	defer func() {
		if err := recover(); err != nil {
			log.WithField("error", err).WithField("alias", alias).Error("failed to extract JB product config")
		}
	}()
	v := reflect.ValueOf(*config.Jetbrains).FieldByNameFunc(func(s string) bool {
		return strings.ToLower(s) == alias
	}).Interface()
	productConfig, ok := v.(*gitpodapi.JetbrainsProduct)
	if !ok {
		return nil
	}
	return productConfig
}
