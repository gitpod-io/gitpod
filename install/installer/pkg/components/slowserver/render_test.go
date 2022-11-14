// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the MIT License. See License-MIT.txt in the project root for license information.

package slowserver

import (
	"testing"

	"github.com/stretchr/testify/require"
	appsv1 "k8s.io/api/apps/v1"
	"k8s.io/utils/pointer"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/components/toxiproxy"
	config "github.com/gitpod-io/gitpod/installer/pkg/config/v1"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1/experimental"
	"github.com/gitpod-io/gitpod/installer/pkg/config/versions"
)

func TestObjects_NotRenderedByDefault(t *testing.T) {
	ctx, err := common.NewRenderContext(config.Config{}, versions.Manifest{}, "test-namespace")
	require.NoError(t, err)

	objects, err := Objects(ctx)
	require.NoError(t, err)
	require.Empty(t, objects, "no objects should be rendered with default config")
}

func TestObjects_RenderedWhenExperimentalConfigSet(t *testing.T) {
	ctx := renderContext(t, true)

	objects, err := Objects(ctx)
	require.NoError(t, err)
	require.NotEmpty(t, objects, "must render objects because experimental config is specified")
	require.Len(t, objects, 9, "should render expected k8s objects")
}

func TestServerDeployment_UsesToxiproxyDbHost(t *testing.T) {
	ctx := renderContext(t, true)

	objects, err := deployment(ctx)
	require.NoError(t, err)

	require.Len(t, objects, 1, "must render only one object")

	deployment := objects[0].(*appsv1.Deployment)

	for _, c := range deployment.Spec.Template.Spec.Containers {
		if c.Name == Component {
			for _, e := range c.Env {
				if e.Name == "DB_HOST" {
					require.Equal(t, toxiproxy.Component, e.Value)
				}
			}
		}
	}
}

func TestServerDeployment_MountsGithubAppSecret(t *testing.T) {
	ctx := renderContext(t, false)

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

func TestServerDeployment_UsesTracingConfig(t *testing.T) {
	ctx := renderContext(t, false)

	objects, err := deployment(ctx)
	require.NoError(t, err)

	require.Len(t, objects, 1, "must render only one object")

	deployment := objects[0].(*appsv1.Deployment)

	serverContainer := deployment.Spec.Template.Spec.Containers[0]

	var envVars = make(map[string]string, len(serverContainer.Env))
	for _, envVar := range serverContainer.Env {
		envVars[envVar.Name] = envVar.Value
	}

	actualSamplerType := envVars["JAEGER_SAMPLER_TYPE"]
	actualSamplerParam := envVars["JAEGER_SAMPLER_PARAM"]

	require.Equal(t, "probabilistic", actualSamplerType)
	require.Equal(t, "12.5", actualSamplerParam)
}

func renderContext(t *testing.T, slowDatabase bool) *common.RenderContext {
	var samplerType experimental.TracingSampleType = "probabilistic"

	ctx, err := common.NewRenderContext(config.Config{
		Database: config.Database{
			InCluster: pointer.Bool(true),
		},
		Observability: config.Observability{
			LogLevel: config.LogLevelInfo,
			Tracing: &config.Tracing{
				Endpoint:  pointer.String("some-endpoint"),
				AgentHost: pointer.String("some-agent-host"),
			},
		},
		Experimental: &experimental.Config{
			WebApp: &experimental.WebAppConfig{
				Tracing: &experimental.Tracing{
					SamplerType:  &samplerType,
					SamplerParam: pointer.Float64(12.5),
				},
				SlowDatabase: slowDatabase,
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
