// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package server

import (
	"fmt"
	"regexp"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/components/workspace"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1/experimental"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
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

	license := ""
	if ctx.Config.License != nil {
		license = licenseFilePath
	}

	workspaceImage := ctx.ImageName(common.ThirdPartyContainerRepo(ctx.Config.Repository, ""), workspace.DefaultWorkspaceImage, workspace.DefaultWorkspaceImageVersion)
	_ = ctx.WithExperimental(func(cfg *experimental.Config) error {
		if cfg.WebApp != nil && cfg.WebApp.Server != nil && cfg.WebApp.Server.WorkspaceDefaults.WorkspaceImage != "" {
			workspaceImage = cfg.WebApp.Server.WorkspaceDefaults.WorkspaceImage
		}
		return nil
	})

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
	_ = ctx.WithExperimental(func(cfg *experimental.Config) error {
		if cfg.WebApp != nil && cfg.WebApp.Server != nil {
			if cfg.WebApp.Server.DefaultBaseImageRegistryWhiteList != nil {
				defaultBaseImageRegistryWhitelist = cfg.WebApp.Server.DefaultBaseImageRegistryWhiteList
			}
		}
		return nil
	})

	chargebeeSecret := ""
	_ = ctx.WithExperimental(func(cfg *experimental.Config) error {
		if cfg.WebApp != nil && cfg.WebApp.Server != nil {
			chargebeeSecret = cfg.WebApp.Server.ChargebeeSecret
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

	var blockedRepositories []BlockedRepository
	err = ctx.WithExperimental(func(cfg *experimental.Config) error {
		if cfg.WebApp != nil && cfg.WebApp.Server != nil && len(cfg.WebApp.Server.BlockedRepositories) > 0 {
			for _, repo := range cfg.WebApp.Server.BlockedRepositories {
				_, err := regexp.Compile(repo.UrlRegExp)
				if err != nil {
					return fmt.Errorf("invalid regexp %q for blocked user URL: %w", repo.UrlRegExp, err)
				}
				blockedRepositories = append(blockedRepositories, BlockedRepository{
					UrlRegExp: repo.UrlRegExp,
					BlockUser: repo.BlockUser,
				})
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

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

	// todo(sje): all these values are configurable
	scfg := ConfigSerialized{
		Version:               ctx.VersionManifest.Version,
		HostURL:               fmt.Sprintf("https://%s", ctx.Config.Domain),
		InstallationShortname: ctx.Config.Metadata.InstallationShortname,
		LicenseFile:           license,
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
			ChunkLimit:                 1000,
			ContentChunkLimit:          1000,
			ContentRetentionPeriodDays: 21,
			Disabled:                   disableWsGarbageCollection,
			MinAgeDays:                 14,
			MinAgePrebuildDays:         7,
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
		BlockedRepositories:               blockedRepositories,
		MakeNewUsersAdmin:                 false,
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
		ContentServiceAddr:           "content-service:8080",
		ImageBuilderAddr:             "image-builder-mk3:8080",
		CodeSync:                     CodeSync{},
		VSXRegistryUrl:               fmt.Sprintf("https://open-vsx.%s", ctx.Config.Domain), // todo(sje): or "https://{{ .Values.vsxRegistry.host | default "open-vsx.org" }}" if not using OpenVSX proxy
		EnablePayment:                chargebeeSecret != "",
		ChargebeeProviderOptionsFile: fmt.Sprintf("%s/providerOptions", chargebeeMountPath),
		InsecureNoDomain:             false,
		PrebuildLimiter: map[string]int{
			// default limit for all cloneURLs
			"*": 50,
		},
	}

	fc, err := common.ToJSONString(scfg)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal server config: %w", err)
	}

	return []runtime.Object{
		&corev1.ConfigMap{
			TypeMeta: common.TypeMetaConfigmap,
			ObjectMeta: metav1.ObjectMeta{
				Name:      fmt.Sprintf("%s-config", Component),
				Namespace: ctx.Namespace,
				Labels:    common.DefaultLabels(Component),
			},
			Data: map[string]string{
				"config.json": string(fc),
			},
		},
	}, nil
}
