// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package server

import (
	"fmt"
	"path/filepath"
	"strings"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/components/auth"
	contentservice "github.com/gitpod-io/gitpod/installer/pkg/components/content-service"
	ideservice "github.com/gitpod-io/gitpod/installer/pkg/components/ide-service"
	"github.com/gitpod-io/gitpod/installer/pkg/components/redis"
	"github.com/gitpod-io/gitpod/installer/pkg/components/usage"
	"github.com/gitpod-io/gitpod/installer/pkg/components/workspace"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1/experimental"
	"github.com/gitpod-io/gitpod/ws-manager/api/config"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/utils/pointer"
)

func configmap(ctx *common.RenderContext) ([]runtime.Object, error) {
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

	runDbDeleter := true
	_ = ctx.WithExperimental(func(cfg *experimental.Config) error {
		if cfg.WebApp != nil && cfg.WebApp.Server != nil && cfg.WebApp.Server.RunDbDeleter != nil {
			runDbDeleter = *cfg.WebApp.Server.RunDbDeleter
		}
		return nil
	})

	defaultBaseImageRegistryWhitelist := []string{}
	allowList := ctx.Config.ContainerRegistry.PrivateBaseImageAllowList
	if len(allowList) > 0 {
		defaultBaseImageRegistryWhitelist = allowList
	}

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

	disableWsGarbageCollection := false
	_ = ctx.WithExperimental(func(cfg *experimental.Config) error {
		if cfg.WebApp != nil && cfg.WebApp.Server != nil {
			disableWsGarbageCollection = cfg.WebApp.Server.DisableWorkspaceGarbageCollection
		}
		return nil
	})

	disableCompleteSnapshotJob := false
	_ = ctx.WithExperimental(func(cfg *experimental.Config) error {
		if cfg.WebApp != nil && cfg.WebApp.Server != nil {
			disableCompleteSnapshotJob = cfg.WebApp.Server.DisableCompleteSnapshotJob
		}
		return nil
	})

	githubApp := GitHubApp{}
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

	workspaceClasses := []WorkspaceClass{
		{
			Id:          config.DefaultWorkspaceClass,
			Category:    GeneralPurpose,
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
				class := WorkspaceClass{
					Id:          cl.Id,
					Category:    WorkspaceClassCategory(cl.Category),
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

	var personalAccessTokenSigningKeyPath string
	_ = ctx.WithExperimental(func(cfg *experimental.Config) error {
		_, _, personalAccessTokenSigningKeyPath, _ = getPersonalAccessTokenSigningKey(cfg)
		return nil
	})

	var isDedicatedInstallation bool
	_ = ctx.WithExperimental(func(cfg *experimental.Config) error {
		if cfg.WebApp != nil && cfg.WebApp.Server != nil {
			isDedicatedInstallation = cfg.WebApp.Server.IsDedicatedInstallation || cfg.WebApp.Server.IsSingleOrgInstallation
		}
		return nil
	})

	_, _, adminCredentialsPath := getAdminCredentials()

	_, _, authCfg := auth.GetConfig(ctx)

	redisConfig := redis.GetConfiguration(ctx)
	_ = ctx.WithExperimental(func(cfg *experimental.Config) error {
		if cfg.WebApp != nil && cfg.WebApp.Redis != nil {
			redisConfig.Address = cfg.WebApp.Redis.Address
		}

		return nil
	})

	// todo(sje): all these values are configurable
	scfg := ConfigSerialized{
		Version:               ctx.VersionManifest.Version,
		HostURL:               fmt.Sprintf("https://%s", ctx.Config.Domain),
		InstallationShortname: ctx.Config.Metadata.InstallationShortname,
		WorkspaceHeartbeat: WorkspaceHeartbeat{
			IntervalSeconds: 60,
			TimeoutSeconds:  300,
		},
		WorkspaceDefaults: WorkspaceDefaults{
			WorkspaceImage:      workspaceImage,
			PreviewFeatureFlags: []NamedWorkspaceFeatureFlag{},
			DefaultFeatureFlags: []NamedWorkspaceFeatureFlag{},
			TimeoutDefault:      ctx.Config.Workspace.TimeoutDefault,
			TimeoutExtended:     ctx.Config.Workspace.TimeoutExtended,
		},
		Session: Session{
			MaxAgeMs: 259200000,
			Secret:   sessionSecret,
		},
		DefinitelyGpDisabled: ctx.Config.DisableDefinitelyGP,
		GitHubApp:            githubApp,
		WorkspaceGarbageCollection: WorkspaceGarbageCollection{
			Disabled:                   disableWsGarbageCollection,
			IntervalSeconds:            1 * 60 * 30, // 30 minutes
			MinAgeDays:                 14,
			MinAgePrebuildDays:         7,
			ChunkLimit:                 1000,
			ContentRetentionPeriodDays: 21,
			ContentChunkLimit:          3000,
			PurgeRetentionPeriodDays:   365,
			PurgeChunkLimit:            5000,
		},
		CompleteSnapshotJob: JobConfig{
			Disabled: disableCompleteSnapshotJob,
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
		IncrementalPrebuilds:              IncrementalPrebuilds{CommitHistory: 100, RepositoryPasslist: []string{}},
		BlockNewUsers:                     ctx.Config.BlockNewUsers,
		DefaultBaseImageRegistryWhitelist: defaultBaseImageRegistryWhitelist,
		RunDbDeleter:                      runDbDeleter,
		OAuthServer: OAuthServer{
			Enabled:   true,
			JWTSecret: jwtSecret,
		},
		RateLimiter: RateLimiter{
			Groups: map[string]GroupsConfig{
				"inWorkspaceUserAction": {
					Points:       10,
					DurationsSec: 2,
				},
			},
			Functions: map[string]FunctionsConfig{
				"openPort":         {Group: "inWorkspaceUserAction"},
				"closePort":        {Group: "inWorkspaceUserAction"},
				"controlAdmission": {Group: "inWorkspaceUserAction"},
				"shareSnapshot":    {Group: "inWorkspaceUserAction"},
			},
		},
		ContentServiceAddr:  common.ClusterAddress(contentservice.Component, ctx.Namespace, contentservice.RPCPort),
		UsageServiceAddr:    common.ClusterAddress(usage.Component, ctx.Namespace, usage.GRPCServicePort),
		IDEServiceAddr:      common.ClusterAddress(ideservice.Component, ctx.Namespace, ideservice.GRPCServicePort),
		MaximumEventLoopLag: 0.35,
		CodeSync:            CodeSync{},
		VSXRegistryUrl:      fmt.Sprintf("https://open-vsx.%s", ctx.Config.Domain), // todo(sje): or "https://{{ .Values.vsxRegistry.host | default "open-vsx.org" }}" if not using OpenVSX proxy
		EnablePayment:       stripeSecret != "" || stripeConfig != "",
		StripeSecretsFile:   fmt.Sprintf("%s/apikeys", stripeSecretMountPath),
		LinkedInSecretsFile: fmt.Sprintf("%s/linkedin", linkedInSecretMountPath),
		InsecureNoDomain:    false,
		PrebuildLimiter: PrebuildRateLimiters{
			// default limit for all cloneURLs
			"*": PrebuildRateLimiterConfig{
				Limit:  100,
				Period: 600,
			},
		},
		WorkspaceClasses:               workspaceClasses,
		InactivityPeriodForReposInDays: inactivityPeriodForReposInDays,
		PATSigningKeyFile:              personalAccessTokenSigningKeyPath,
		Admin: AdminConfig{
			CredentialsPath: adminCredentialsPath,
		},
		Auth:                    authCfg,
		Redis:                   redisConfig,
		IsDedicatedInstallation: isDedicatedInstallation,
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

func getPersonalAccessTokenSigningKey(cfg *experimental.Config) (corev1.Volume, corev1.VolumeMount, string, bool) {
	var volume corev1.Volume
	var mount corev1.VolumeMount
	var path string

	if cfg == nil || cfg.WebApp == nil || cfg.WebApp.PublicAPI == nil || cfg.WebApp.PublicAPI.PersonalAccessTokenSigningKeySecretName == "" {
		return volume, mount, path, false
	}

	personalAccessTokenSecretname := cfg.WebApp.PublicAPI.PersonalAccessTokenSigningKeySecretName
	path = personalAccessTokenSigningKeyMountPath

	volume = corev1.Volume{
		Name: "personal-access-token-signing-key",
		VolumeSource: corev1.VolumeSource{
			Secret: &corev1.SecretVolumeSource{
				SecretName: personalAccessTokenSecretname,
				Optional:   pointer.Bool(true),
			},
		},
	}

	mount = corev1.VolumeMount{
		Name:      "personal-access-token-signing-key",
		MountPath: personalAccessTokenSigningKeyMountPath,
		SubPath:   "personal-access-token-signing-key",
		ReadOnly:  true,
	}

	return volume, mount, path, true
}

func getAdminCredentials() (corev1.Volume, corev1.VolumeMount, string) {
	volume := corev1.Volume{
		Name: "admin-credentials",
		VolumeSource: corev1.VolumeSource{
			Secret: &corev1.SecretVolumeSource{
				SecretName: AdminCredentialsSecretName,
				Optional:   pointer.Bool(true),
			},
		},
	}

	mount := corev1.VolumeMount{
		Name:      "admin-credentials",
		MountPath: AdminCredentialsSecretMountPath,
		ReadOnly:  true,
	}

	return volume, mount, filepath.Join(AdminCredentialsSecretMountPath, AdminCredentialsSecretKey)
}
