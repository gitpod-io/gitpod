// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the MIT License. See License-MIT.txt in the project root for license information.

package common

import (
	"testing"

	"github.com/gitpod-io/gitpod/installer/pkg/config/v1"
	"github.com/gitpod-io/gitpod/installer/pkg/config/versions"
	"github.com/google/go-cmp/cmp"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/utils/pointer"
)

func TestCompositeRenderFunc_NilObjectsNilError(t *testing.T) {
	f := CompositeRenderFunc(
		func(cfg *RenderContext) ([]runtime.Object, error) {
			return nil, nil
		})

	ctx, err := NewRenderContext(config.Config{}, versions.Manifest{}, "test_namespace")
	require.NoError(t, err)

	objects, err := f(ctx)
	require.NoError(t, err)
	require.Len(t, objects, 0)
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

				ctx, err := NewRenderContext(config.Config{
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
