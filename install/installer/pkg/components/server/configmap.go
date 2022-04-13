// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package server

import (
	"fmt"

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
		if cfg.WebApp != nil && cfg.WebApp.OAuthServer.JWTSecret != "" {
			jwtSecret = cfg.WebApp.OAuthServer.JWTSecret
		}
		return nil
	})

	license := ""
	if ctx.Config.License != nil {
		license = licenseFilePath
	}

	workspaceImage := common.ImageName(common.ThirdPartyContainerRepo(ctx.Config.Repository, ""), workspace.DefaultWorkspaceImage, workspace.DefaultWorkspaceImageVersion)
	_ = ctx.WithExperimental(func(cfg *experimental.Config) error {
		if cfg.WebApp != nil && cfg.WebApp.WorkspaceDefaults.WorkspaceImage != "" {
			workspaceImage = cfg.WebApp.WorkspaceDefaults.WorkspaceImage
		}
		return nil
	})

	sessionSecret := "Important!Really-Change-This-Key!"
	_ = ctx.WithExperimental(func(cfg *experimental.Config) error {
		if cfg.WebApp != nil && cfg.WebApp.Session.Secret != "" {
			sessionSecret = cfg.WebApp.Session.Secret
		}
		return nil
	})

	// todo(sje): all these values are configurable
	scfg := ConfigSerialized{
		Version:               ctx.VersionManifest.Version,
		HostURL:               fmt.Sprintf("https://%s", ctx.Config.Domain),
		InstallationShortname: ctx.Config.Metadata.InstallationShortname,
		Stage:                 "production", // todo(sje): is this needed?
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
		WorkspaceGarbageCollection: WorkspaceGarbageCollection{
			ChunkLimit:                 1000,
			ContentChunkLimit:          1000,
			ContentRetentionPeriodDays: 21,
			Disabled:                   false,
			MinAgeDays:                 14,
			MinAgePrebuildDays:         7,
		},
		EnableLocalApp: true,
		AuthProviderConfigFiles: func() []string {
			providers := make([]string, 0)

			// Appending "/provider" here in order to play nicely with the telepresence hack
			for _, provider := range ctx.Config.AuthProviders {
				providers = append(providers, fmt.Sprintf("%s/%s/provider", authProviderFilePath, provider.Name))
			}

			return providers
		}(),
		BuiltinAuthProvidersConfigured:    len(ctx.Config.AuthProviders) > 0,
		DisableDynamicAuthProviderLogin:   false,
		MaxEnvvarPerUserCount:             4048,
		MaxConcurrentPrebuildsPerRef:      10,
		IncrementalPrebuilds:              IncrementalPrebuilds{CommitHistory: 100, RepositoryPasslist: []string{}},
		BlockNewUsers:                     ctx.Config.BlockNewUsers,
		MakeNewUsersAdmin:                 false,
		DefaultBaseImageRegistryWhitelist: []string{},
		RunDbDeleter:                      true,
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
		EnablePayment:                false,
		InsecureNoDomain:             false,
		ChargebeeProviderOptionsFile: "/chargebee/providerOptions",
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
