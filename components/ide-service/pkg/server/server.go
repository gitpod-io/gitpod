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

type IDEServiceServer struct {
	config                 *config.ServiceConfiguration
	originIDEConfig        []byte
	parsedIDEConfigContent string
	ideConfig              *config.IDEConfig
	ideConfigFileName      string

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
	}
	return s
}

func (s *IDEServiceServer) register(grpcServer *grpc.Server) {
	api.RegisterIDEServiceServer(grpcServer, s)
}

func (s *IDEServiceServer) GetConfig(ctx context.Context, req *api.GetConfigRequest) (*api.GetConfigResponse, error) {
	return &api.GetConfigResponse{
		Content: s.parsedIDEConfigContent,
	}, nil
}

func (s *IDEServiceServer) readIDEConfig(ctx context.Context, isInit bool) {
	b, err := os.ReadFile(s.ideConfigFileName)
	if err != nil {
		log.WithError(err).Warn("cannot read ide config file")
		return
	}
	if config, err := ParseConfig(ctx, b); err != nil {
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
		s.parsedIDEConfigContent = string(parsedConfig)
		s.ideConfig = config
		s.originIDEConfig = b

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
	DefaultIde       string `json:"defaultIde,omitempty"`
	UseLatestVersion bool   `json:"useLatestVersion,omitempty"`
}

type WorkspaceContext struct {
	Referrer    string `json:"referrer,omitempty"`
	ReferrerIde string `json:"referrerIde,omitempty"`
}

var JetbrainsCode map[string]string

func init() {
	JetbrainsCode = make(map[string]string)
	JetbrainsCode["intellij"] = "IIU"
	JetbrainsCode["goland"] = "GO"
	JetbrainsCode["pycharm"] = "PCP"
	JetbrainsCode["phpstorm"] = "PS"
	JetbrainsCode["rubymine"] = "RM"
	JetbrainsCode["webstorm"] = "WS"
	JetbrainsCode["rider"] = "RD"
	JetbrainsCode["clion"] = "CL"
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
	ideConfig := s.ideConfig

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
	}

	// TODO: reconsider this
	// if req.Type != api.WorkspaceType_REGULAR {
	// 	return resp, nil
	// }

	var wsConfig *gitpodapi.GitpodConfig
	var wsContext *WorkspaceContext
	var ideSettings *IDESettings

	if req.IdeSettings != "" {
		if err := json.Unmarshal([]byte(req.IdeSettings), &ideSettings); err != nil {
			log.WithError(err).WithField("ideSetting", req.IdeSettings).Error("failed to parse ide settings")
		}
	}
	if req.WorkspaceConfig != "" {
		if err := json.Unmarshal([]byte(req.WorkspaceConfig), &wsConfig); err != nil {
			log.WithError(err).WithField("workspaceConfig", req.WorkspaceConfig).Error("failed to parse workspace config")
		}
	}
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

	getUserPluginImage := func(ideOption *config.IDEOption) string {
		if useLatest && ideOption.PluginLatestImage != "" {
			return ideOption.PluginLatestImage
		}

		return ideOption.PluginImage
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

	var desktopImageLayer string
	var desktopPluginImageLayer string
	if chosenIDE.Type == config.IDETypeDesktop {
		desktopImageLayer = getUserIDEImage(chosenIDE)
		desktopPluginImageLayer = getUserPluginImage(chosenIDE)
	} else {
		resp.WebImage = getUserIDEImage(chosenIDE)
	}

	ideName, referrer := s.resolveReferrerIDE(ideConfig, wsContext, userIdeName)
	if ideName != "" {
		resp.RefererIde = ideName
		desktopImageLayer = getUserIDEImage(referrer)
		desktopPluginImageLayer = getUserPluginImage(referrer)
	}

	if desktopImageLayer != "" {
		resp.IdeImageLayers = append(resp.IdeImageLayers, desktopImageLayer)
		if desktopPluginImageLayer != "" {
			resp.IdeImageLayers = append(resp.IdeImageLayers, desktopPluginImageLayer)
		}
	}

	jbGW, ok := ideConfig.IdeOptions.Clients["jetbrains-gateway"]
	if req.Type == api.WorkspaceType_PREBUILD && ok {
		warmUpTask := ""
		for _, alias := range jbGW.DesktopIDEs {
			prebuilds := getPrebuilds(wsConfig, alias)
			if prebuilds != nil {
				if prebuilds.Version != "latest" {
					template := `
echo 'warming up stable release of ${key}...'
echo 'downloading stable ${key} backend...'
mkdir /tmp/backend
curl -sSLo /tmp/backend/backend.tar.gz "https://download.jetbrains.com/product?type=release&distribution=linux&code=${productCode}"
tar -xf /tmp/backend/backend.tar.gz --strip-components=1 --directory /tmp/backend

echo 'configuring JB system config and caches aligned with runtime...'
printf '\nshared.indexes.download.auto.consent=true' >> "/tmp/backend/bin/idea.properties"
unset JAVA_TOOL_OPTIONS
export IJ_HOST_CONFIG_BASE_DIR=/workspace/.config/JetBrains
export IJ_HOST_SYSTEM_BASE_DIR=/workspace/.cache/JetBrains

echo 'running stable ${key} backend in warmup mode...'
/tmp/backend/bin/remote-dev-server.sh warmup "$GITPOD_REPO_ROOT"

echo 'removing stable ${key} backend...'
rm -rf /tmp/backend
`
					if code, ok := JetbrainsCode[alias]; ok {
						template = strings.ReplaceAll(template, "${key}", alias)
						template = strings.ReplaceAll(template, "${productCode}", code)
						warmUpTask += template
					}
				}

				if prebuilds.Version != "stable" {
					template := `
echo 'warming up latest release of ${key}...'
echo 'downloading latest ${key} backend...'
mkdir /tmp/backend-latest
curl -sSLo /tmp/backend-latest/backend-latest.tar.gz "https://download.jetbrains.com/product?type=release,eap,rc&distribution=linux&code=${productCode}"
tar -xf /tmp/backend-latest/backend-latest.tar.gz --strip-components=1 --directory /tmp/backend-latest

echo 'configuring JB system config and caches aligned with runtime...'
printf '\nshared.indexes.download.auto.consent=true' >> "/tmp/backend-latest/bin/idea.properties"
unset JAVA_TOOL_OPTIONS
export IJ_HOST_CONFIG_BASE_DIR=/workspace/.config/JetBrains-latest
export IJ_HOST_SYSTEM_BASE_DIR=/workspace/.cache/JetBrains-latest

echo 'running ${key} backend in warmup mode...'
/tmp/backend-latest/bin/remote-dev-server.sh warmup "$GITPOD_REPO_ROOT"

echo 'removing latest ${key} backend...'
rm -rf /tmp/backend-latest
`
					if code, ok := JetbrainsCode[alias]; ok {
						template = strings.ReplaceAll(template, "${key}", alias)
						template = strings.ReplaceAll(template, "${productCode}", code)
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
