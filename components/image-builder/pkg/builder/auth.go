// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package builder

import (
	"encoding/base64"
	"encoding/json"
	"os"

	"github.com/gitpod-io/gitpod/image-builder/api"

	"github.com/docker/cli/cli/config/configfile"
	"github.com/docker/distribution/reference"
	"github.com/docker/docker/api/types"
	"github.com/gitpod-io/gitpod/common-go/log"
	"golang.org/x/xerrors"
)

// RegistryAuthenticator can provide authentication for some registries
type RegistryAuthenticator interface {
	// Authenticate attempts to provide authentication for Docker registry access
	Authenticate(registry string) (auth *types.AuthConfig, err error)
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
func (a *DockerConfigFileAuth) Authenticate(registry string) (auth *types.AuthConfig, err error) {
	ac, err := a.C.GetAuthConfig(registry)
	if err != nil {
		return nil, err
	}

	return &types.AuthConfig{
		Username:      ac.Username,
		Password:      ac.Password,
		Auth:          ac.Auth,
		Email:         ac.Email,
		ServerAddress: ac.ServerAddress,
		IdentityToken: ac.IdentityToken,
		RegistryToken: ac.RegistryToken,
	}, nil
}

type allowedAuthFor struct {
	All      bool
	Explicit []string
}

var (
	allowedAuthForAll  allowedAuthFor = allowedAuthFor{true, nil}
	allowedAuthForNone allowedAuthFor = allowedAuthFor{false, nil}
)

func (a allowedAuthFor) IsAllowNone() bool {
	return !a.All && len(a.Explicit) == 0
}

func (a allowedAuthFor) IsAllowAll() bool {
	return a.All
}

func (a allowedAuthFor) Elevate(ref string) allowedAuthFor {
	pref, _ := reference.ParseNormalizedNamed(ref)
	if pref == nil {
		log.WithField("ref", ref).Debug("cannot elevate auth for invalid image ref")
		return a
	}

	return allowedAuthFor{a.All, append(a.Explicit, reference.Domain(pref))}
}

// resolveRequestAuth computes the allowed authentication for a build based on its request
func (b *DockerBuilder) resolveRequestAuth(auth *api.BuildRegistryAuth) (authFor allowedAuthFor) {
	// by default we allow nothing
	authFor = allowedAuthForNone
	if auth == nil {
		return
	}

	switch ath := auth.Mode.(type) {
	case *api.BuildRegistryAuth_Total:
		if ath.Total.AllowAll {
			authFor = allowedAuthForAll
		} else {
			authFor = allowedAuthForNone
		}
	case *api.BuildRegistryAuth_Selective:
		var explicit []string
		if ath.Selective.AllowBaserep {
			ref, _ := reference.ParseNormalizedNamed(b.Config.BaseImageRepository)
			explicit = append(explicit, reference.Domain(ref))
		}
		if ath.Selective.AllowWorkspacerep {
			ref, _ := reference.ParseNormalizedNamed(b.Config.WorkspaceImageRepository)
			explicit = append(explicit, reference.Domain(ref))
		}
		explicit = append(explicit, ath.Selective.AnyOf...)
		authFor = allowedAuthFor{false, explicit}
	default:
		authFor = allowedAuthForNone
	}
	return
}

// getAuthFor computes the base64 encoded auth format for a Docker image pull/push
func (a allowedAuthFor) getAuthFor(auth RegistryAuthenticator, refstr string) (res string, err error) {
	if auth == nil {
		return "", nil
	}

	ref, err := reference.ParseNormalizedNamed(refstr)
	if err != nil {
		return "", xerrors.Errorf("cannot parse image ref: %v", err)
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
		return "", nil
	}

	rauth, err := auth.Authenticate(reg)
	if err != nil {
		return "", xerrors.Errorf("cannot get registry authentication: %v", err)
	}

	encodedJSON, err := json.Marshal(rauth)
	if err != nil {
		return "", err
	}
	res = base64.URLEncoding.EncodeToString(encodedJSON)

	return
}

// imageBuildAuth is the format image builds needs
type imageBuildAuth map[string]types.AuthConfig

func (a allowedAuthFor) getImageBuildAuthFor(auth RegistryAuthenticator, refstr []string) (res imageBuildAuth, err error) {
	if auth == nil {
		return nil, nil
	}

	res = make(imageBuildAuth)
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

		res[reg] = *ra
	}
	for _, reg := range a.Explicit {
		if _, ok := res[reg]; ok {
			continue
		}

		ra, err := auth.Authenticate(reg)
		if err != nil {
			return nil, xerrors.Errorf("cannot get registry authentication: %v", err)
		}

		res[reg] = *ra
	}

	return
}
