// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package common

import (
	"fmt"
	"strings"

	"github.com/distribution/reference"
	"helm.sh/helm/v3/pkg/cli/values"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/utils/pointer"

	config "github.com/gitpod-io/gitpod/installer/pkg/config/v1"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1/experimental"
	"github.com/gitpod-io/gitpod/installer/pkg/config/versions"
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
			if len(obj) == 0 {
				// the RenderFunc chose not to render anything, possibly based on config it received
				continue
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

type GeneratedValues struct {
	StorageAccessKey             string
	StorageSecretKey             string
	InternalRegistryUsername     string
	InternalRegistryPassword     string
	InternalRegistrySharedSecret string
}

type RenderContext struct {
	VersionManifest versions.Manifest
	Config          config.Config
	Namespace       string
	Values          GeneratedValues

	experimentalConfig *experimental.Config
}

// WithExperimental provides access to the unsupported config. This will only do something
// if the unsupported config is present.
//
// This is intentionally a function rather than an exported field to keep unsupported
// config clearly marked as such, and to make sure we can easily remove/disable it.
func (r *RenderContext) WithExperimental(mod func(ucfg *experimental.Config) error) error {
	if r.experimentalConfig == nil {
		return nil
	}

	return mod(r.experimentalConfig)
}

func (r *RenderContext) RepoName(repo, name string) string {
	var ref string
	if repo == "" {
		ref = name
	} else {
		ref = fmt.Sprintf("%s/%s", strings.TrimSuffix(repo, "/"), name)
	}
	pref, err := reference.ParseNormalizedNamed(ref)
	if err != nil {
		panic(fmt.Sprintf("cannot parse image repo %s: %v", ref, err))
	}

	if pointer.BoolDeref(r.Config.DropImageRepo, false) {
		segs := strings.Split(reference.Path(pref), "/")
		return fmt.Sprintf("%s/%s", r.Config.Repository, segs[len(segs)-1])
	}

	return pref.String()
}

func (r *RenderContext) ImageName(repo, name, tag string) string {
	ref := fmt.Sprintf("%s:%s", r.RepoName(repo, name), tag)
	pref, err := reference.ParseNamed(ref)
	if err != nil {
		panic(fmt.Sprintf("cannot parse image ref %s: %v", ref, err))
	}
	if _, ok := pref.(reference.Tagged); !ok {
		panic(fmt.Sprintf("image ref %s has no tag: %v", ref, err))
	}

	return ref
}

func (r *RenderContext) ImageDigest(repo, name, digest string) string {
	ref := fmt.Sprintf("%s@%s", r.RepoName(repo, name), digest)
	pref, err := reference.ParseNamed(ref)
	if err != nil {
		panic(fmt.Sprintf("cannot parse image ref %s: %v", ref, err))
	}
	if _, ok := pref.(reference.Digested); !ok {
		panic(fmt.Sprintf("image ref %s has no digest: %v", ref, err))
	}
	return ref
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

	internalRegistryUsername, err := RandomString(20)
	if err != nil {
		return err
	}
	r.Values.InternalRegistryUsername = internalRegistryUsername

	internalRegistryPassword, err := RandomString(20)
	if err != nil {
		return err
	}
	r.Values.InternalRegistryPassword = internalRegistryPassword

	internalRegistrySharedSecret, err := RandomString(20)
	if err != nil {
		return err
	}
	r.Values.InternalRegistrySharedSecret = internalRegistrySharedSecret

	return nil
}

// NewRenderContext constructor function to create a new RenderContext with the values generated
func NewRenderContext(cfg config.Config, versionManifest versions.Manifest, namespace string) (*RenderContext, error) {
	us := cfg.Experimental
	cfg.Experimental = nil

	ctx := &RenderContext{
		Config:             cfg,
		VersionManifest:    versionManifest,
		Namespace:          namespace,
		experimentalConfig: us,
	}

	err := ctx.generateValues()
	if err != nil {
		return nil, err
	}

	return ctx, nil
}
