// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package auth

import (
	"os"

	"github.com/docker/cli/cli/config/configfile"
	"github.com/docker/distribution/reference"
	"github.com/docker/docker/api/types"
	"golang.org/x/xerrors"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/image-builder/api"
)

// RegistryAuthenticator can provide authentication for some registries
type RegistryAuthenticator interface {
	// Authenticate attempts to provide authentication for Docker registry access
	Authenticate(registry string) (auth *Authentication, err error)
}

// NewDockerConfigFileAuth reads a docker config file to provide authentication
func NewDockerConfigFileAuth(fn string) (*DockerConfigFileAuth, error) {
	fp, err := os.OpenFile(fn, os.O_RDONLY, 0600)
	if err != nil {
		return nil, err
	}
	defer fp.Close()

	cfg := configfile.New(fn)
	err = cfg.LoadFromReader(fp)
	if err != nil {
		return nil, err
	}

	return &DockerConfigFileAuth{cfg}, nil
}

// DockerConfigFileAuth uses a Docker config file to provide authentication
type DockerConfigFileAuth struct {
	C *configfile.ConfigFile
}

// Authenticate attempts to provide an encoded authentication string for Docker registry access
func (a *DockerConfigFileAuth) Authenticate(registry string) (auth *Authentication, err error) {
	ac, err := a.C.GetAuthConfig(registry)
	if err != nil {
		return nil, err
	}

	return &Authentication{
		Username:      ac.Username,
		Password:      ac.Password,
		Auth:          ac.Auth,
		Email:         ac.Email,
		ServerAddress: ac.ServerAddress,
		IdentityToken: ac.IdentityToken,
		RegistryToken: ac.RegistryToken,
	}, nil
}

// Authentication represents docker usable authentication
type Authentication types.AuthConfig

// AllowedAuthFor describes for which repositories authentication may be provided for
type AllowedAuthFor struct {
	All      bool
	Explicit []string
}

var (
	// AllowedAuthForAll means auth for all repositories is allowed
	AllowedAuthForAll AllowedAuthFor = AllowedAuthFor{true, nil}
	// AllowedAuthForNone means auth for no repositories is allowed
	AllowedAuthForNone AllowedAuthFor = AllowedAuthFor{false, nil}
)

// IsAllowNone returns true if we are to allow authentication for no repos
func (a AllowedAuthFor) IsAllowNone() bool {
	return !a.All && len(a.Explicit) == 0
}

// IsAllowAll returns true if we are to allow authentication for all repos
func (a AllowedAuthFor) IsAllowAll() bool {
	return a.All
}

// Elevate adds a ref to the list of authenticated repositories
func (a AllowedAuthFor) Elevate(ref string) AllowedAuthFor {
	pref, _ := reference.ParseNormalizedNamed(ref)
	if pref == nil {
		log.WithField("ref", ref).Debug("cannot elevate auth for invalid image ref")
		return a
	}

	return AllowedAuthFor{a.All, append(a.Explicit, reference.Domain(pref))}
}

// ExplicitlyAll produces an AllowedAuthFor that allows authentication for all
// registries, yet carries the original Explicit list which affects GetAuthForImageBuild
func (a AllowedAuthFor) ExplicitlyAll() AllowedAuthFor {
	return AllowedAuthFor{
		All:      true,
		Explicit: a.Explicit,
	}
}

// Resolver resolves an auth request determining which authentication is actually allowed
type Resolver struct {
	BaseImageRepository      string
	WorkspaceImageRepository string
}

// ResolveRequestAuth computes the allowed authentication for a build based on its request
func (r Resolver) ResolveRequestAuth(auth *api.BuildRegistryAuth) (authFor AllowedAuthFor) {
	// by default we allow nothing
	authFor = AllowedAuthForNone
	if auth == nil {
		return
	}

	switch ath := auth.Mode.(type) {
	case *api.BuildRegistryAuth_Total:
		if ath.Total.AllowAll {
			authFor = AllowedAuthForAll
		} else {
			authFor = AllowedAuthForNone
		}
	case *api.BuildRegistryAuth_Selective:
		var explicit []string
		if ath.Selective.AllowBaserep {
			ref, _ := reference.ParseNormalizedNamed(r.BaseImageRepository)
			explicit = append(explicit, reference.Domain(ref))
		}
		if ath.Selective.AllowWorkspacerep {
			ref, _ := reference.ParseNormalizedNamed(r.WorkspaceImageRepository)
			explicit = append(explicit, reference.Domain(ref))
		}
		explicit = append(explicit, ath.Selective.AnyOf...)
		authFor = AllowedAuthFor{false, explicit}
	default:
		authFor = AllowedAuthForNone
	}
	return
}

// GetAuthFor computes the base64 encoded auth format for a Docker image pull/push
func (a AllowedAuthFor) GetAuthFor(auth RegistryAuthenticator, refstr string) (res *Authentication, err error) {
	if auth == nil {
		return
	}

	ref, err := reference.ParseNormalizedNamed(refstr)
	if err != nil {
		return nil, xerrors.Errorf("cannot parse image ref: %v", err)
	}

	reg := reference.Domain(ref)
	var regAllowed bool
	if a.IsAllowAll() {
		// free for all
		regAllowed = true
	} else {
		for _, a := range a.Explicit {
			if a == reg {
				regAllowed = true
				break
			}
		}
	}
	if !regAllowed {
		log.WithField("reg", reg).WithField("ref", ref).WithField("a", a).Debug("registry not allowed")
		return nil, nil
	}

	return auth.Authenticate(reg)
}

// ImageBuildAuth is the format image builds needs
type ImageBuildAuth map[string]types.AuthConfig

// GetImageBuildAuthFor produces authentication in the format an image builds needs
func (a AllowedAuthFor) GetImageBuildAuthFor(auth RegistryAuthenticator, refstr []string) (res ImageBuildAuth, err error) {
	if auth == nil {
		return nil, nil
	}

	res = make(ImageBuildAuth)
	for _, r := range refstr {
		ref, err := reference.ParseNormalizedNamed(r)
		if err != nil {
			return nil, xerrors.Errorf("cannot parse image ref: %v", err)
		}

		reg := reference.Domain(ref)
		var regAllowed bool
		if a.IsAllowAll() {
			// free for all
			regAllowed = true
		} else {
			for _, a := range a.Explicit {
				if a == reg {
					regAllowed = true
					break
				}
			}
		}
		if !regAllowed {
			continue
		}

		ra, err := auth.Authenticate(reg)
		if err != nil {
			return nil, xerrors.Errorf("cannot get registry authentication: %v", err)
		}

		res[reg] = types.AuthConfig(*ra)
	}
	for _, reg := range a.Explicit {
		if _, ok := res[reg]; ok {
			continue
		}

		ra, err := auth.Authenticate(reg)
		if err != nil {
			return nil, xerrors.Errorf("cannot get registry authentication: %v", err)
		}

		res[reg] = types.AuthConfig(*ra)
	}

	return
}
