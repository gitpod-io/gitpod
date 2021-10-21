// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package common

import (
	"sort"

	"github.com/gitpod-io/gitpod/installer/pkg/config/v1"
	"github.com/gitpod-io/gitpod/installer/pkg/config/versions"

	"helm.sh/helm/v3/pkg/cli/values"
	"k8s.io/apimachinery/pkg/runtime"
)

// Renderable turns the config into a set of Kubernetes runtime objects
type RenderFunc func(cfg *RenderContext) ([]runtime.Object, error)

type HelmFunc func(cfg *RenderContext) ([]string, error)

type HelmConfig struct {
	Enabled bool
	Values  *values.Options
}

func CompositeRenderFunc(f ...RenderFunc) RenderFunc {
	return func(ctx *RenderContext) ([]runtime.Object, error) {
		var res []runtime.Object
		for _, g := range f {
			obj, err := g(ctx)
			if err != nil {
				return nil, err
			}
			res = append(res, obj...)
		}
		return res, nil
	}
}

func CompositeHelmFunc(f ...HelmFunc) HelmFunc {
	return func(ctx *RenderContext) ([]string, error) {
		var res []string
		for _, g := range f {
			str, err := g(ctx)
			if err != nil {
				return nil, err
			}
			res = append(res, str...)
		}
		return res, nil
	}
}

var kubernetesObjOrder = map[string]int{
	TypeMetaClusterRole.GetObjectKind().GroupVersionKind().String():    -100,
	TypeMetaServiceAccount.GetObjectKind().GroupVersionKind().String(): -90,
	TypeMetaDaemonset.GetObjectKind().GroupVersionKind().String():      0,
	TypeMetaPod.GetObjectKind().GroupVersionKind().String():            10,
}

func DependencySortingRenderFunc(f RenderFunc) RenderFunc {
	return func(ctx *RenderContext) ([]runtime.Object, error) {
		objs, err := f(ctx)
		if err != nil {
			return nil, err
		}

		sort.Slice(objs, func(i, j int) bool {
			scoreI := kubernetesObjOrder[objs[i].GetObjectKind().GroupVersionKind().String()]
			scoreJ := kubernetesObjOrder[objs[j].GetObjectKind().GroupVersionKind().String()]

			return scoreI < scoreJ
		})

		return objs, nil
	}
}

type GeneratedValues struct {
	StorageAccessKey string
	StorageSecretKey string
}

type RenderContext struct {
	VersionManifest versions.Manifest
	Config          config.Config
	Namespace       string
	Values          GeneratedValues
}

// generateValues generates the random values used throughout the context
// todo(sje): find a way of persisting these values for updates
func (r *RenderContext) generateValues() error {
	storageAccessKey, err := RandomString(20)
	if err != nil {
		return err
	}
	r.Values.StorageAccessKey = storageAccessKey

	storageSecretKey, err := RandomString(20)
	if err != nil {
		return err
	}
	r.Values.StorageSecretKey = storageSecretKey

	return nil
}

// NewRenderContext constructor function to create a new RenderContext with the values generated
func NewRenderContext(cfg config.Config, versionManifest versions.Manifest, namespace string) (*RenderContext, error) {
	ctx := &RenderContext{
		Config:          cfg,
		VersionManifest: versionManifest,
		Namespace:       namespace,
	}

	err := ctx.generateValues()
	if err != nil {
		return nil, err
	}

	return ctx, nil
}
