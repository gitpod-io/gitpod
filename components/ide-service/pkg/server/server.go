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
	"strings"
	"time"

	"github.com/gitpod-io/gitpod/common-go/baseserver"
	"github.com/gitpod-io/gitpod/common-go/experiments"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/watch"
	gitpodapi "github.com/gitpod-io/gitpod/gitpod-protocol"
	api "github.com/gitpod-io/gitpod/ide-service-api"
	"github.com/gitpod-io/gitpod/ide-service-api/config"
	"github.com/heptiolabs/healthcheck"
	"github.com/muesli/cache2go"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/sirupsen/logrus"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/health/grpc_health_v1"
)

type ideConfigSnapshot struct {
	content string
	value   *config.IDEConfig
}

type IDEServiceServer struct {
	config            *config.ServiceConfiguration
	ideConfig         *ideConfigSnapshot
	ideConfigFileName string
	experiemntsClient experiments.Client
	cache             *cache2go.CacheTable

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

	s := New(cfg)
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

func New(cfg *config.ServiceConfiguration) *IDEServiceServer {
	fn, err := filepath.Abs(cfg.IDEConfigPath)
	if err != nil {
		log.WithField("path", cfg.IDEConfigPath).WithError(err).Fatal("cannot convert ide config path to abs path")
	}

	s := &IDEServiceServer{
		config:            cfg,
		ideConfigFileName: fn,
		experiemntsClient: experiments.NewClient(),
		cache:             cache2go.Cache("manifests"),
	}
	return s
}

func (s *IDEServiceServer) register(grpcServer *grpc.Server) {
	api.RegisterIDEServiceServer(grpcServer, s)
}

func parseIDESettings(ideSettings string) *IDESettings {
	var settings IDESettings
	if err := json.Unmarshal([]byte(ideSettings), &settings); err != nil {
		log.WithError(err).WithField("ideSetting", ideSettings).Error("failed to parse ide settings")
		return nil
	}
	return &settings
}

func (s *IDEServiceServer) GetConfig(ctx context.Context, req *api.GetConfigRequest) (*api.GetConfigResponse, error) {
	ideSettings := parseIDESettings(req.IdeSettings)
	ideConfig := s.resolveConfig(ctx, ideSettings, false)
	return &api.GetConfigResponse{
		Content: ideConfig.content,
	}, nil
}

func (s *IDEServiceServer) resolveConfig(ctx context.Context, ideSettings *IDESettings, skipMarshal bool) *ideConfigSnapshot {
	// make a copy for ref ideConfig, it's safe because we replace ref in update config
	ideConfig := s.ideConfig

	var userOptions []*config.IDEOption
	if ideSettings != nil {
		for _, customImageRef := range ideSettings.CustomImageRefs {
			// TODO latest channel support
			option, err := s.resolveIDEOption(ctx, customImageRef, "user")
			if err != nil {
				log.WithError(err).WithField("image", customImageRef).Error("failed to resolve user ide image")
				continue
			}
			userOptions = append(userOptions, option)
		}
	}

	if len(userOptions) == 0 {
		return ideConfig
	}

	var copyConfig *config.IDEConfig
	if err := json.Unmarshal([]byte(ideConfig.content), &copyConfig); err != nil {
		log.WithError(err).Error("cannot parse ide config")
		return ideConfig
	}

	for i, option := range userOptions {
		option.OrderKey = fmt.Sprintf("u-%d", i)
		copyConfig.IdeOptions.Options[option.Name] = *option
	}

	if skipMarshal {
		return &ideConfigSnapshot{
			value:   copyConfig,
			content: "",
		}
	}

	copyContent, err := json.Marshal(copyConfig)
	if err != nil {
		log.WithError(err).Error("cannot marshal ide config")
		return ideConfig
	}

	return &ideConfigSnapshot{
		value:   copyConfig,
		content: string(copyContent),
	}
}

func (s *IDEServiceServer) readIDEConfig(ctx context.Context, isInit bool) {
	b, err := os.ReadFile(s.ideConfigFileName)
	if err != nil {
		log.WithError(err).Warn("cannot read ide config file")
		return
	}
	if config, err := s.parseConfig(ctx, b); err != nil {
		if !isInit {
			log.WithError(err).Fatal("cannot parse ide config")
		}
		log.WithError(err).Error("cannot parse ide config")
		return
	} else {
		parsedConfig, err := json.Marshal(config)
		if err != nil {
			log.WithError(err).Error("cannot marshal ide config")
			return
		}
		content := string(parsedConfig)
		s.ideConfig = &ideConfigSnapshot{
			value:   config,
			content: content,
		}
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
	DefaultIde       string   `json:"defaultIde,omitempty"`
	UseLatestVersion bool     `json:"useLatestVersion,omitempty"`
	CustomImageRefs  []string `json:"customImageRefs,omitempty"`
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

	ideSettings := parseIDESettings(req.IdeSettings)
	ideConfig := s.resolveConfig(ctx, ideSettings, true).value

	var defaultIde *config.IDEOption

	if ide, ok := ideConfig.IdeOptions.Options[ideConfig.IdeOptions.DefaultIde]; !ok {
		// I think it never happen, we have a check to make sure all DefaultIDE should be in Options
		log.WithError(err).WithField("defaultIDE", ideConfig.IdeOptions.DefaultIde).Error("IDE configuration corrupt, cannot found defaultIDE")
		return nil, fmt.Errorf("IDE configuration corrupt")
	} else {
		defaultIde = &ide
	}

	resp = &api.ResolveWorkspaceConfigResponse{
		SupervisorImage: ideConfig.SupervisorImage,
		WebImage:        defaultIde.Image,
		IdeImageLayers:  defaultIde.ImageLayers,
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

	if req.Type == api.WorkspaceType_REGULAR {
		var wsContext *WorkspaceContext

		if req.Context != "" {
			if err := json.Unmarshal([]byte(req.Context), &wsContext); err != nil {
				log.WithError(err).WithField("context", req.Context).Error("failed to parse context")
			}
		}

		userIdeName := ""
		useLatest := false

		if ideSettings != nil {
			userIdeName = ideSettings.DefaultIde
			useLatest = ideSettings.UseLatestVersion
		}

		chosenIDE := defaultIde

		getUserIDEImage := func(ideOption *config.IDEOption) string {
			if useLatest && ideOption.LatestImage != "" {
				return ideOption.LatestImage
			}

			return ideOption.Image
		}

		getUserImageLayers := func(ideOption *config.IDEOption) []string {
			if useLatest {
				return ideOption.LatestImageLayers
			}

			return ideOption.ImageLayers
		}

		if userIdeName != "" {
			if ide, ok := ideConfig.IdeOptions.Options[userIdeName]; ok {
				chosenIDE = &ide

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
		resp.WebImage = getUserIDEImage(defaultIde)
		resp.IdeImageLayers = getUserImageLayers(defaultIde)

		var desktopImageLayer string
		var desktopUserImageLayers []string
		if chosenIDE.Type == config.IDETypeDesktop {
			desktopImageLayer = getUserIDEImage(chosenIDE)
			desktopUserImageLayers = getUserImageLayers(chosenIDE)
		} else {
			resp.WebImage = getUserIDEImage(chosenIDE)
			resp.IdeImageLayers = getUserImageLayers(chosenIDE)
		}

		ideName, referrer := s.resolveReferrerIDE(ideConfig, wsContext, userIdeName)
		if ideName != "" {
			resp.RefererIde = ideName
			desktopImageLayer = getUserIDEImage(referrer)
			desktopUserImageLayers = getUserImageLayers(referrer)
		}

		if desktopImageLayer != "" {
			resp.IdeImageLayers = append(resp.IdeImageLayers, desktopImageLayer)
			resp.IdeImageLayers = append(resp.IdeImageLayers, desktopUserImageLayers...)
		}
	}

	jbGW, ok := ideConfig.IdeOptions.Clients["jetbrains-gateway"]
	if req.Type == api.WorkspaceType_PREBUILD && ok {
		warmUpTask := ""
		imageLayers := make(map[string]struct{})
		for _, alias := range jbGW.DesktopIDEs {
			prebuilds := getPrebuilds(wsConfig, alias)
			if prebuilds != nil {
				if prebuilds.Version != "latest" {
					if ide, ok := ideConfig.IdeOptions.Options[alias]; ok {
						for _, ideImageLayer := range ide.ImageLayers {
							if _, ok := imageLayers[ideImageLayer]; !ok {
								imageLayers[ideImageLayer] = struct{}{}
								resp.IdeImageLayers = append(resp.IdeImageLayers, ideImageLayer)
							}
						}
						resp.IdeImageLayers = append(resp.IdeImageLayers, ide.Image)
						template := `
echo 'warming up stable release of ${key}...'
JETBRAINS_BACKEND_QUALIFIER=stable /ide-desktop/jb-launcher warmup ${key}
`
						template = strings.ReplaceAll(template, "${key}", alias)
						warmUpTask += template
					}
				}

				if prebuilds.Version != "stable" {
					if ide, ok := ideConfig.IdeOptions.Options[alias]; ok {
						for _, latestIdeImageLayer := range ide.LatestImageLayers {
							if _, ok := imageLayers[latestIdeImageLayer]; !ok {
								imageLayers[latestIdeImageLayer] = struct{}{}
								resp.IdeImageLayers = append(resp.IdeImageLayers, latestIdeImageLayer)
							}
						}
						resp.IdeImageLayers = append(resp.IdeImageLayers, ide.LatestImage)
						template := `
echo 'warming up latest release of ${key}...'
JETBRAINS_BACKEND_QUALIFIER=latest /ide-desktop/jb-launcher warmup ${key}
`
						template = strings.ReplaceAll(template, "${key}", alias)
						warmUpTask += template
					}
				}
			}
		}

		if warmUpTask != "" {
			warmUpEncoded := new(bytes.Buffer)
			enc := json.NewEncoder(warmUpEncoded)
			enc.SetEscapeHTML(false)

			err := enc.Encode(&[]gitpodapi.TaskConfig{{
				Init: strings.TrimSpace(warmUpTask),
				Name: "GITPOD_JB_WARMUP_TASK",
			}})
			if err != nil {
				log.WithError(err).Error("cannot marshal warm up task")
			}

			resp.Tasks = warmUpEncoded.String()
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
