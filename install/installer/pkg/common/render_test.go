// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
/// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package common_test

import (
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/stretchr/testify/require"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/utils/pointer"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	content_service "github.com/gitpod-io/gitpod/installer/pkg/components/content-service"
	"github.com/gitpod-io/gitpod/installer/pkg/components/dashboard"
	"github.com/gitpod-io/gitpod/installer/pkg/components/server"
	config "github.com/gitpod-io/gitpod/installer/pkg/config/v1"
	"github.com/gitpod-io/gitpod/installer/pkg/config/versions"
)

func TestCompositeRenderFunc_NilObjectsNilError(t *testing.T) {
	f := common.CompositeRenderFunc(
		func(cfg *common.RenderContext) ([]runtime.Object, error) {
			return nil, nil
		})

	ctx, err := common.NewRenderContext(config.Config{}, versions.Manifest{}, "test_namespace")
	require.NoError(t, err)

	objects, err := f(ctx)
	require.NoError(t, err)
	require.Len(t, objects, 0)
}

func TestReplicas(t *testing.T) {
	testCases := []struct {
		Component        string
		Name             string
		ExpectedReplicas int32
	}{
		{
			Component:        server.Component,
			Name:             "server takes replica count from common config",
			ExpectedReplicas: 123,
		},
		{
			Component:        dashboard.Component,
			Name:             "dashboard takes replica count from common config",
			ExpectedReplicas: 456,
		},
		{
			Component:        content_service.Component,
			Name:             "content_service takes default replica count",
			ExpectedReplicas: 1,
		},
	}
	ctx, err := common.NewRenderContext(config.Config{
		Components: &config.Components{
			PodConfig: map[string]*config.PodConfig{
				"server":    {Replicas: pointer.Int32(123)},
				"dashboard": {Replicas: pointer.Int32(456)},
			},
		},
	}, versions.Manifest{}, "test_namespace")
	require.NoError(t, err)

	for _, testCase := range testCases {
		t.Run(testCase.Name, func(t *testing.T) {
			actualReplicas := common.Replicas(ctx, testCase.Component)

			if *actualReplicas != testCase.ExpectedReplicas {
				t.Errorf("expected %d replicas for %q component, but got %d",
					testCase.ExpectedReplicas, testCase.Component, *actualReplicas)
			}
		})
	}
}

func TestResourceRequirements(t *testing.T) {
	defaultResources := corev1.ResourceRequirements{
		Requests: corev1.ResourceList{
			"cpu":    resource.MustParse("200m"),
			"memory": resource.MustParse("200Mi"),
		},
		Limits: corev1.ResourceList{
			"cpu":    resource.MustParse("200m"),
			"memory": resource.MustParse("200Mi"),
		},
	}

	serverResources := corev1.ResourceRequirements{
		Requests: corev1.ResourceList{
			"cpu":    resource.MustParse("50m"),
			"memory": resource.MustParse("100Mi"),
		},
		Limits: corev1.ResourceList{
			"cpu":    resource.MustParse("500m"),
			"memory": resource.MustParse("800Mi"),
		},
	}

	dashboardResources := corev1.ResourceRequirements{
		Requests: corev1.ResourceList{
			"cpu":    resource.MustParse("60m"),
			"memory": resource.MustParse("100Mi"),
		},
		Limits: corev1.ResourceList{
			"cpu":    resource.MustParse("100m"),
			"memory": resource.MustParse("500Mi"),
		},
	}

	testCases := []struct {
		Component         string
		ContainerName     string
		Name              string
		ExpectedResources corev1.ResourceRequirements
	}{
		{
			Component:         server.Component,
			ContainerName:     server.Component,
			Name:              "server takes resource requirements from config",
			ExpectedResources: serverResources,
		},
		{
			Component:         dashboard.Component,
			ContainerName:     dashboard.Component,
			Name:              "dashboard takes resource requirements from config",
			ExpectedResources: dashboardResources,
		},
		{
			Component:         content_service.Component,
			Name:              "content_service takes default resource requirements",
			ExpectedResources: defaultResources,
		},
	}
	ctx, err := common.NewRenderContext(config.Config{
		Components: &config.Components{
			PodConfig: map[string]*config.PodConfig{
				server.Component: {
					Resources: map[string]*corev1.ResourceRequirements{
						server.Component: &serverResources,
					},
				},
				dashboard.Component: {
					Resources: map[string]*corev1.ResourceRequirements{
						dashboard.Component: &dashboardResources,
					},
				},
			},
		},
	}, versions.Manifest{}, "test_namespace")
	require.NoError(t, err)

	for _, testCase := range testCases {
		t.Run(testCase.Name, func(t *testing.T) {
			actualResources := common.ResourceRequirements(ctx, testCase.Component, testCase.ContainerName, defaultResources)

			if actualResources.Limits["cpu"] != testCase.ExpectedResources.Limits["cpu"] {
				t.Errorf("expected cpu limits for container %q in component %q to be %+v, but got %+v",
					testCase.Component, testCase.ContainerName, testCase.ExpectedResources.Limits["cpu"], actualResources.Limits["cpu"])
			}
			if actualResources.Limits["memory"] != testCase.ExpectedResources.Limits["memory"] {
				t.Errorf("expected memory limits for container %q in component %q to be %+v, but got %+v",
					testCase.Component, testCase.ContainerName, testCase.ExpectedResources.Limits["memory"], actualResources.Limits["memory"])
			}
			if actualResources.Requests["cpu"] != testCase.ExpectedResources.Requests["cpu"] {
				t.Errorf("expected cpu requests for container %q in component %q to be %+v, but got %+v",
					testCase.Component, testCase.ContainerName, testCase.ExpectedResources.Requests["cpu"], actualResources.Requests["cpu"])
			}
			if actualResources.Requests["memory"] != testCase.ExpectedResources.Requests["memory"] {
				t.Errorf("expected memory requests for container %q in component %q to be %+v, but got %+v",
					testCase.Component, testCase.ContainerName, testCase.ExpectedResources.Requests["memory"], actualResources.Requests["memory"])
			}
		})
	}
}

func TestRepoName(t *testing.T) {
	type Expectation struct {
		Result string
		Panics bool
	}
	tests := []struct {
		Repo          string
		Name          string
		Expectation   Expectation
		CfgRepo       string
		DropImageRepo *bool
	}{
		{
			Name: "gitpod-io/workspace-full",
			Expectation: Expectation{
				Result: "docker.io/gitpod-io/workspace-full",
			},
		},
		{
			Repo: "some-repo.com",
			Name: "some-image",
			Expectation: Expectation{
				Result: "some-repo.com/some-image",
			},
		},
		{
			Repo: "some-repo",
			Name: "not@avalid#image-name",
			Expectation: Expectation{
				Panics: true,
			},
		},
		// Drop repo, no namespace
		{
			Name: "gitpod-io/workspace-full",
			Expectation: Expectation{
				Result: "some.registry.com/workspace-full",
			},
			CfgRepo:       "some.registry.com",
			DropImageRepo: pointer.Bool(true),
		},
		{
			Repo: "some-repo.com",
			Name: "some-image",
			Expectation: Expectation{
				Result: "some.registry.com/some-image",
			},
			CfgRepo:       "some.registry.com",
			DropImageRepo: pointer.Bool(true),
		},
		{
			Repo: "some-repo",
			Name: "not@avalid#image-name",
			Expectation: Expectation{
				Panics: true,
			},
			CfgRepo:       "some.registry.com",
			DropImageRepo: pointer.Bool(true),
		},
		// Drop repo, namespace
		{
			Name: "gitpod-io/workspace-full",
			Expectation: Expectation{
				Result: "some.registry.com/gitpod/workspace-full",
			},
			CfgRepo:       "some.registry.com/gitpod",
			DropImageRepo: pointer.Bool(true),
		},
		{
			Repo: "some-repo.com",
			Name: "some-image",
			Expectation: Expectation{
				Result: "some.registry.com/gitpod/some-image",
			},
			CfgRepo:       "some.registry.com/gitpod",
			DropImageRepo: pointer.Bool(true),
		},
		{
			Repo: "some-repo",
			Name: "not@avalid#image-name",
			Expectation: Expectation{
				Panics: true,
			},
			CfgRepo:       "some.registry.com/gitpod",
			DropImageRepo: pointer.Bool(true),
		},
	}

	for _, test := range tests {
		t.Run(test.Repo+"/"+test.Name, func(t *testing.T) {
			var act Expectation
			func() {
				defer func() {
					if recover() != nil {
						act.Panics = true
					}
				}()

				ctx, err := common.NewRenderContext(config.Config{
					DropImageRepo: test.DropImageRepo,
					Repository:    test.CfgRepo,
				}, versions.Manifest{}, "test_namespace")
				require.NoError(t, err)

				act.Result = ctx.RepoName(test.Repo, test.Name)
			}()

			if diff := cmp.Diff(test.Expectation, act); diff != "" {
				t.Errorf("RepoName() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}
