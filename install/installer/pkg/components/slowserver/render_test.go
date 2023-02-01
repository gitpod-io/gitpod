// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
/// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package slowserver

import (
	"testing"

	"github.com/stretchr/testify/require"
	appsv1 "k8s.io/api/apps/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	"k8s.io/utils/pointer"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/components/toxiproxy"
	config "github.com/gitpod-io/gitpod/installer/pkg/config/v1"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1/experimental"
	"github.com/gitpod-io/gitpod/installer/pkg/config/versions"
	corev1 "k8s.io/api/core/v1"
	v1 "k8s.io/api/core/v1"
)

func TestObjects_NotRenderedByDefault(t *testing.T) {
	ctx, err := common.NewRenderContext(config.Config{}, versions.Manifest{}, "test-namespace")
	require.NoError(t, err)

	objects, err := Objects(ctx)
	require.NoError(t, err)
	require.Empty(t, objects, "no objects should be rendered with default config")
}

func TestServerDeployment_UsesToxiproxyDbHost(t *testing.T) {
	slowDbHost := toxiproxy.Component
	ctx := renderContext(t, nil, slowDbHost)

	objects, err := deployment(ctx)
	require.NoError(t, err)

	require.Len(t, objects, 1, "must render only one object")

	deployment := objects[0].(*appsv1.Deployment)

	for _, c := range deployment.Spec.Template.Spec.Containers {
		if c.Name == Component {
			for _, e := range c.Env {
				if e.Name == "DB_HOST" {
					require.Equal(t, slowDbHost, e.Value)
				}
			}
		}
	}
}

func TestServerDeployment_DbWaiterUsesToxiproxyDbHost(t *testing.T) {
	slowDbHost := toxiproxy.Component
	ctx := renderContext(t, nil, slowDbHost)

	objects, err := deployment(ctx)
	require.NoError(t, err)

	require.Len(t, objects, 1, "must render only one object")

	deployment := objects[0].(*appsv1.Deployment)

	var dbWaiterContainers []v1.Container
	for _, c := range deployment.Spec.Template.Spec.InitContainers {
		if c.Name == "database-waiter" {
			dbWaiterContainers = append(dbWaiterContainers, c)
		}
	}
	require.Equal(t, len(dbWaiterContainers), 1)

	waiterContainer := dbWaiterContainers[0]
	for _, e := range waiterContainer.Env {
		if e.Name == "DB_HOST" {
			require.Equal(t, slowDbHost, e.Value)
		}
	}
}

func TestSlowServerDeployment_UsesServerReplicaCountAndResources(t *testing.T) {
	resources := map[string]*v1.ResourceRequirements{
		common.ServerComponent: {
			Limits: corev1.ResourceList{
				"cpu":    resource.MustParse("300m"),
				"memory": resource.MustParse("300Mi"),
			},
			Requests: corev1.ResourceList{
				"cpu":    resource.MustParse("200m"),
				"memory": resource.MustParse("200Mi"),
			},
		},
	}

	podConfig := map[string]*config.PodConfig{
		common.ServerComponent: {
			Replicas:  pointer.Int32(5),
			Resources: resources,
		},
	}

	slowDbHost := toxiproxy.Component
	ctx := renderContext(t, podConfig, slowDbHost)

	objects, err := deployment(ctx)
	require.NoError(t, err)

	require.Len(t, objects, 1, "must render only one object")

	deployment := objects[0].(*appsv1.Deployment)

	require.NotNil(t, deployment.Spec.Replicas, "replica count must be specified")
	require.Equal(t, int32(5), *deployment.Spec.Replicas, "unexpected number of replicas")

	for _, c := range deployment.Spec.Template.Spec.Containers {
		if c.Name == Component {
			expectedResources := *resources[common.ServerComponent]
			actualResources := c.Resources

			require.Equal(t, expectedResources.Limits["cpu"], actualResources.Limits["cpu"], "cpu limit not set correctly")
			require.Equal(t, expectedResources.Limits["memory"], actualResources.Limits["memory"], "memory limit not set correctly")
			require.Equal(t, expectedResources.Requests["cpu"], actualResources.Requests["cpu"], "cpu request not set correctly")
			require.Equal(t, expectedResources.Requests["memory"], actualResources.Requests["memory"], "memory request not set correctly")
		}
	}
}

func TestServerDeployment_MountsGithubAppSecret(t *testing.T) {
	ctx := renderContext(t, nil, "")

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
	ctx := renderContext(t, nil, "")

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

func renderContext(t *testing.T, podConfig map[string]*config.PodConfig, slowDatabaseHost string) *common.RenderContext {
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
		Components: &config.Components{
			PodConfig: podConfig,
		},
		Experimental: &experimental.Config{
			WebApp: &experimental.WebAppConfig{
				Tracing: &experimental.Tracing{
					SamplerType:  &samplerType,
					SamplerParam: pointer.Float64(12.5),
				},
				SlowDatabase: slowDatabaseHost,
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
