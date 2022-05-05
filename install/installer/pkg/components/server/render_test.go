// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the MIT License. See License-MIT.txt in the project root for license information.

package server

import (
	"testing"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1/experimental"
	"github.com/gitpod-io/gitpod/installer/pkg/config/versions"
	"github.com/stretchr/testify/require"
	appsv1 "k8s.io/api/apps/v1"
	"k8s.io/utils/pointer"
)

func TestServerDeployment_MountsGithubAppSecret(t *testing.T) {
	ctx := renderContext(t)

	objects, err := deployment(ctx)
	require.NoError(t, err)

	require.Len(t, objects, 1, "must render only one object")

	deployment := objects[0].(*appsv1.Deployment)

	foundVol := false
	for _, vol := range deployment.Spec.Template.Spec.Volumes {
		if vol.Name == githubAppCertSecret {
			foundVol = true
		}
	}

	require.Truef(t, foundVol, "failed to find expected volume %q on server pod", githubAppCertSecret)

	serverContainer := deployment.Spec.Template.Spec.Containers[0]
	foundMount := false
	for _, vol := range serverContainer.VolumeMounts {
		if vol.Name == githubAppCertSecret {
			foundMount = true
		}
	}

	require.Truef(t, foundMount, "failed to find expected volume mount %q on server container", githubAppCertSecret)
}

func renderContext(t *testing.T) *common.RenderContext {
	ctx, err := common.NewRenderContext(config.Config{
		Database: config.Database{
			InCluster: pointer.Bool(true),
		},
		Experimental: &experimental.Config{
			WebApp: &experimental.WebAppConfig{
				Server: &experimental.ServerConfig{
					GithubApp: &experimental.GithubApp{
						AppId:           0,
						AuthProviderId:  "",
						BaseUrl:         "",
						CertPath:        "/some/cert/path",
						Enabled:         false,
						LogLevel:        "",
						MarketplaceName: "",
						WebhookSecret:   "",
						CertSecretName:  "some-secret-name",
					},
				},
			},
		},
	}, versions.Manifest{
		Components: versions.Components{
			ServiceWaiter: versions.Versioned{
				Version: "arbitrary",
			},
			Server: versions.Versioned{
				Version: "arbitrary",
			},
		},
	}, "test-namespace")
	require.NoError(t, err)

	return ctx
}
