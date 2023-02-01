// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package slowserver

import (
	"fmt"
	"net"
	"strconv"
	"strings"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	contentservice "github.com/gitpod-io/gitpod/installer/pkg/components/content-service"
	ideservice "github.com/gitpod-io/gitpod/installer/pkg/components/ide-service"
	"github.com/gitpod-io/gitpod/installer/pkg/components/server"
	"github.com/gitpod-io/gitpod/installer/pkg/components/usage"
	"github.com/gitpod-io/gitpod/installer/pkg/components/workspace"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1/experimental"
	"github.com/gitpod-io/gitpod/ws-manager/api/config"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func configmap(ctx *common.RenderContext) ([]runtime.Object, error) {
	// The random `jwtSecret` value is overwritten by config in production clusters.
	// For preview environments, the value will vary between `server` and `slow-server` deployments.
	// This variance could have an effect on integration with the local companion app.
	jwtSecret, err := common.RandomString(20)
	if err != nil {
		return nil, err
	}
	_ = ctx.WithExperimental(func(cfg *experimental.Config) error {
		if cfg.WebApp != nil && cfg.WebApp.Server != nil && cfg.WebApp.Server.OAuthServer.JWTSecret != "" {
			jwtSecret = cfg.WebApp.Server.OAuthServer.JWTSecret
		}
		return nil
	})

	license := ""
	if ctx.Config.License != nil {
		license = licenseFilePath
	}

	workspaceImage := ctx.Config.Workspace.WorkspaceImage
	if workspaceImage == "" {
		workspaceImage = ctx.ImageName(common.ThirdPartyContainerRepo(ctx.Config.Repository, ""), workspace.DefaultWorkspaceImage, workspace.DefaultWorkspaceImageVersion)
	}

	sessionSecret := "Important!Really-Change-This-Key!"
	_ = ctx.WithExperimental(func(cfg *experimental.Config) error {
		if cfg.WebApp != nil && cfg.WebApp.Server != nil && cfg.WebApp.Server.Session.Secret != "" {
			sessionSecret = cfg.WebApp.Server.Session.Secret
		}
		return nil
	})

	disableDynamicAuthProviderLogin := false
	_ = ctx.WithExperimental(func(cfg *experimental.Config) error {
		if cfg.WebApp != nil && cfg.WebApp.Server != nil {
			disableDynamicAuthProviderLogin = cfg.WebApp.Server.DisableDynamicAuthProviderLogin
		}
		return nil
	})

	enableLocalApp := true
	_ = ctx.WithExperimental(func(cfg *experimental.Config) error {
		if cfg.WebApp != nil && cfg.WebApp.Server != nil && cfg.WebApp.Server.EnableLocalApp != nil {
			enableLocalApp = *cfg.WebApp.Server.EnableLocalApp
		}
		return nil
	})

	defaultBaseImageRegistryWhitelist := []string{}
	allowList := ctx.Config.ContainerRegistry.PrivateBaseImageAllowList
	if len(allowList) > 0 {
		defaultBaseImageRegistryWhitelist = allowList
	}

	chargebeeSecret := ""
	_ = ctx.WithExperimental(func(cfg *experimental.Config) error {
		if cfg.WebApp != nil && cfg.WebApp.Server != nil {
			chargebeeSecret = cfg.WebApp.Server.ChargebeeSecret
		}
		return nil
	})

	stripeSecret := ""
	_ = ctx.WithExperimental(func(cfg *experimental.Config) error {
		if cfg.WebApp != nil && cfg.WebApp.Server != nil {
			stripeSecret = cfg.WebApp.Server.StripeSecret
		}
		return nil
	})

	stripeConfig := ""
	_ = ctx.WithExperimental(func(cfg *experimental.Config) error {
		if cfg.WebApp != nil && cfg.WebApp.Server != nil {
			stripeConfig = cfg.WebApp.Server.StripeConfig
		}
		return nil
	})

	githubApp := server.GitHubApp{}
	_ = ctx.WithExperimental(func(cfg *experimental.Config) error {
		if cfg.WebApp != nil && cfg.WebApp.Server != nil && cfg.WebApp.Server.GithubApp != nil {
			githubApp.AppId = cfg.WebApp.Server.GithubApp.AppId
			githubApp.AuthProviderId = cfg.WebApp.Server.GithubApp.AuthProviderId
			githubApp.BaseUrl = cfg.WebApp.Server.GithubApp.BaseUrl
			githubApp.CertPath = cfg.WebApp.Server.GithubApp.CertPath
			githubApp.Enabled = cfg.WebApp.Server.GithubApp.Enabled
			githubApp.LogLevel = cfg.WebApp.Server.GithubApp.LogLevel
			githubApp.MarketplaceName = cfg.WebApp.Server.GithubApp.MarketplaceName
			githubApp.WebhookSecret = cfg.WebApp.Server.GithubApp.WebhookSecret
			githubApp.CertSecretName = cfg.WebApp.Server.GithubApp.CertSecretName
		}
		return nil
	})

	workspaceClasses := []server.WorkspaceClass{
		{
			Id:          config.DefaultWorkspaceClass,
			Category:    server.GeneralPurpose,
			DisplayName: strings.Title(config.DefaultWorkspaceClass),
			Description: "Default workspace class",
			PowerUps:    1,
			IsDefault:   true,
		},
	}
	ctx.WithExperimental(func(cfg *experimental.Config) error {
		if cfg.WebApp != nil && cfg.WebApp.WorkspaceClasses != nil && len(cfg.WebApp.WorkspaceClasses) > 0 {
			workspaceClasses = nil
			for _, cl := range cfg.WebApp.WorkspaceClasses {
				class := server.WorkspaceClass{
					Id:          cl.Id,
					Category:    server.WorkspaceClassCategory(cl.Category),
					DisplayName: cl.DisplayName,
					Description: cl.Description,
					PowerUps:    cl.PowerUps,
					IsDefault:   cl.IsDefault,
					Marker:      cl.Marker,
				}

				workspaceClasses = append(workspaceClasses, class)
			}
		}

		return nil
	})

	inactivityPeriodForReposInDays := 0
	_ = ctx.WithExperimental(func(cfg *experimental.Config) error {
		if cfg.WebApp != nil && cfg.WebApp.Server != nil && cfg.WebApp.Server.InactivityPeriodForReposInDays != nil {
			inactivityPeriodForReposInDays = *cfg.WebApp.Server.InactivityPeriodForReposInDays
		}
		return nil
	})

	// todo(sje): all these values are configurable
	scfg := server.ConfigSerialized{
		Version:               ctx.VersionManifest.Version,
		HostURL:               fmt.Sprintf("https://%s", ctx.Config.Domain),
		InstallationShortname: ctx.Config.Metadata.InstallationShortname,
		LicenseFile:           license,
		WorkspaceHeartbeat: server.WorkspaceHeartbeat{
			IntervalSeconds: 60,
			TimeoutSeconds:  300,
		},
		WorkspaceDefaults: server.WorkspaceDefaults{
			WorkspaceImage:      workspaceImage,
			PreviewFeatureFlags: []server.NamedWorkspaceFeatureFlag{},
			DefaultFeatureFlags: []server.NamedWorkspaceFeatureFlag{},
			TimeoutDefault:      ctx.Config.Workspace.TimeoutDefault,
			TimeoutExtended:     ctx.Config.Workspace.TimeoutExtended,
		},
		Session: server.Session{
			MaxAgeMs: 259200000,
			Secret:   sessionSecret,
		},
		DefinitelyGpDisabled: ctx.Config.DisableDefinitelyGP,
		GitHubApp:            githubApp,
		WorkspaceGarbageCollection: server.WorkspaceGarbageCollection{
			Disabled:                   true,
			IntervalSeconds:            5 * 60,
			MinAgeDays:                 14,
			MinAgePrebuildDays:         7,
			ChunkLimit:                 1000,
			ContentRetentionPeriodDays: 21,
			ContentChunkLimit:          100,
			PurgeRetentionPeriodDays:   365,
			PurgeChunkLimit:            5000,
		},
		EnableLocalApp: enableLocalApp,
		AuthProviderConfigFiles: func() []string {
			providers := make([]string, 0)

			// Appending "/provider" here in order to play nicely with the telepresence hack
			for _, provider := range ctx.Config.AuthProviders {
				providers = append(providers, fmt.Sprintf("%s/%s/provider", authProviderFilePath, provider.Name))
			}

			return providers
		}(),
		DisableDynamicAuthProviderLogin:   disableDynamicAuthProviderLogin,
		MaxEnvvarPerUserCount:             4048,
		MaxConcurrentPrebuildsPerRef:      10,
		IncrementalPrebuilds:              server.IncrementalPrebuilds{CommitHistory: 100, RepositoryPasslist: []string{}},
		BlockNewUsers:                     ctx.Config.BlockNewUsers,
		MakeNewUsersAdmin:                 false,
		DefaultBaseImageRegistryWhitelist: defaultBaseImageRegistryWhitelist,
		RunDbDeleter:                      false,
		OAuthServer: server.OAuthServer{
			Enabled:   true,
			JWTSecret: jwtSecret,
		},
		RateLimiter: server.RateLimiter{
			Groups: map[string]server.GroupsConfig{
				"inWorkspaceUserAction": {
					Points:       10,
					DurationsSec: 2,
				},
			},
			Functions: map[string]server.FunctionsConfig{
				"openPort":         {Group: "inWorkspaceUserAction"},
				"closePort":        {Group: "inWorkspaceUserAction"},
				"controlAdmission": {Group: "inWorkspaceUserAction"},
				"shareSnapshot":    {Group: "inWorkspaceUserAction"},
			},
		},
		ContentServiceAddr:           net.JoinHostPort(fmt.Sprintf("%s.%s.svc.cluster.local", contentservice.Component, ctx.Namespace), strconv.Itoa(contentservice.RPCPort)),
		UsageServiceAddr:             net.JoinHostPort(fmt.Sprintf("%s.%s.svc.cluster.local", usage.Component, ctx.Namespace), strconv.Itoa(usage.GRPCServicePort)),
		IDEServiceAddr:               net.JoinHostPort(fmt.Sprintf("%s.%s.svc.cluster.local", ideservice.Component, ctx.Namespace), strconv.Itoa(ideservice.GRPCServicePort)),
		MaximumEventLoopLag:          0.35,
		CodeSync:                     server.CodeSync{},
		VSXRegistryUrl:               fmt.Sprintf("https://open-vsx.%s", ctx.Config.Domain), // todo(sje): or "https://{{ .Values.vsxRegistry.host | default "open-vsx.org" }}" if not using OpenVSX proxy
		EnablePayment:                chargebeeSecret != "" || stripeSecret != "" || stripeConfig != "",
		ChargebeeProviderOptionsFile: fmt.Sprintf("%s/providerOptions", chargebeeMountPath),
		StripeSecretsFile:            fmt.Sprintf("%s/apikeys", stripeSecretMountPath),
		StripeConfigFile:             fmt.Sprintf("%s/config", stripeConfigMountPath),
		InsecureNoDomain:             false,
		PrebuildLimiter: server.PrebuildRateLimiters{
			// default limit for all cloneURLs
			"*": server.PrebuildRateLimiterConfig{
				Limit:  100,
				Period: 600,
			},
		},
		WorkspaceClasses:               workspaceClasses,
		InactivityPeriodForReposInDays: inactivityPeriodForReposInDays,
		Admin: server.AdminConfig{
			GrantFirstUserAdminRole: true, // existing default
		},
		AdminLoginKeyFile: server.AdminLoginKeyFile(ctx),
	}

	fc, err := common.ToJSONString(scfg)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal server config: %w", err)
	}

	return []runtime.Object{
		&corev1.ConfigMap{
			TypeMeta: common.TypeMetaConfigmap,
			ObjectMeta: metav1.ObjectMeta{
				Name:        fmt.Sprintf("%s-config", Component),
				Namespace:   ctx.Namespace,
				Labels:      common.CustomizeLabel(ctx, Component, common.TypeMetaConfigmap),
				Annotations: common.CustomizeAnnotation(ctx, Component, common.TypeMetaConfigmap),
			},
			Data: map[string]string{
				"config.json": string(fc),
			},
		},
	}, nil
}
