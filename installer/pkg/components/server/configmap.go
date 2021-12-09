// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package server

import (
	"encoding/json"
	"fmt"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/components/workspace"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func configmap(ctx *common.RenderContext) ([]runtime.Object, error) {
	jwtSecret, err := common.RandomString(20)
	if err != nil {
		return nil, err
	}

	license := ""
	if ctx.Config.License != nil {
		license = licenseFilePath
	}

	// todo(sje): all these values are configurable
	scfg := ConfigSerialized{
		Version:               ctx.VersionManifest.Version,
		HostURL:               fmt.Sprintf("https://%s", ctx.Config.Domain),
		InstallationShortname: ctx.Namespace, // todo(sje): is this needed?
		Stage:                 "production",  // todo(sje): is this needed?
		LicenseFile:           license,
		WorkspaceHeartbeat: WorkspaceHeartbeat{
			IntervalSeconds: 60,
			TimeoutSeconds:  300,
		},
		WorkspaceDefaults: WorkspaceDefaults{
			WorkspaceImage:      common.ImageName(common.ThirdPartyContainerRepo(ctx.Config.Repository, ""), workspace.DefaultWorkspaceImage, workspace.DefaultWorkspaceImageVersion),
			PreviewFeatureFlags: []NamedWorkspaceFeatureFlag{},
			DefaultFeatureFlags: []NamedWorkspaceFeatureFlag{},
		},
		Session: Session{
			MaxAgeMs: 259200000,
			Secret:   "Important!Really-Change-This-Key!", // todo(sje): how best to do this?
		},
		DefinitelyGpDisabled: false,
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

			for _, provider := range ctx.Config.AuthProviders {
				providers = append(providers, fmt.Sprintf("%s/%s", authProviderFilePath, provider.Name))
			}

			return providers
		}(),
		BuiltinAuthProvidersConfigured:  len(ctx.Config.AuthProviders) > 0,
		DisableDynamicAuthProviderLogin: false,
		BrandingConfig: BrandingConfig{
			Logo:     "/images/gitpod-ddd.svg",
			Homepage: fmt.Sprintf("https://%s/", ctx.Config.Domain),
			Links: BrandingLinks{
				Header: []Link{{
					Name: "Workspaces",
					URL:  "/workspaces/",
				}, {
					Name: "Docs",
					URL:  "https://www.gitpod.io/docs/",
				}, {
					Name: "Blog",
					URL:  "https://www.gitpod.io/blog/",
				}, {
					Name: "Community",
					URL:  "https://community.gitpod.io/",
				}},
				Footer: []Link{{
					Name: "Docs",
					URL:  "https://www.gitpod.io/docs/",
				}, {
					Name: "Blog",
					URL:  "https://www.gitpod.io/blog/",
				}, {
					Name: "Status",
					URL:  "https://status.gitpod.io/",
				}},
				Social: []SocialLink{{
					Type: "GitHub",
					URL:  "https://github.com/gitpod-io/gitpod",
				}, {
					Type: "Discourse",
					URL:  "https://community.gitpod.io/",
				}, {
					Type: "Twitter",
					URL:  "https://twitter.com/gitpod",
				}},
				Legal: []Link{{
					Name: "Imprint",
					URL:  "https://www.gitpod.io/imprint/",
				}, {
					Name: "Privacy Policy",
					URL:  "https://www.gitpod.io/privacy/",
				}, {
					Name: "Terms of Service",
					URL:  "https://www.gitpod.io/terms/",
				}},
			},
		},
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
	}

	fc, err := json.MarshalIndent(scfg, "", " ")
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
