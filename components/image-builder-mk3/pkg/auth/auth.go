// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package auth

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"os"
	"strings"
	"sync"

	"github.com/docker/cli/cli/config/configfile"
	"github.com/docker/distribution/reference"
	"github.com/docker/docker/api/types"
	"golang.org/x/xerrors"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/watch"
	"github.com/gitpod-io/gitpod/image-builder/api"
)

// RegistryAuthenticator can provide authentication for some registries
type RegistryAuthenticator interface {
	// Authenticate attempts to provide authentication for Docker registry access
	Authenticate(registry string) (auth *Authentication, err error)
}

// NewDockerConfigFileAuth reads a docker config file to provide authentication
func NewDockerConfigFileAuth(fn string) (*DockerConfigFileAuth, error) {
	res := &DockerConfigFileAuth{}
	err := res.loadFromFile(fn)
	if err != nil {
		return nil, err
	}

	err = watch.File(context.Background(), fn, func() {
		res.loadFromFile(fn)
	})
	if err != nil {
		return nil, err
	}

	return res, nil
}

// DockerConfigFileAuth uses a Docker config file to provide authentication
type DockerConfigFileAuth struct {
	C *configfile.ConfigFile

	hash string
	mu   sync.RWMutex
}

func (a *DockerConfigFileAuth) loadFromFile(fn string) (err error) {
	defer func() {
		if err != nil {
			err = fmt.Errorf("error loading Docker config from %s: %w", fn, err)
		}
	}()

	cntnt, err := os.ReadFile(fn)
	if err != nil {
		return err
	}
	hash := sha256.New()
	_, _ = hash.Write(cntnt)
	newHash := fmt.Sprintf("%x", hash.Sum(nil))
	if a.hash == newHash {
		return nil
	}

	log.WithField("path", fn).Info("reloading auth from Docker config")

	cfg := configfile.New(fn)
	err = cfg.LoadFromReader(bytes.NewReader(cntnt))
	if err != nil {
		return err
	}

	a.mu.Lock()
	defer a.mu.Unlock()
	a.C = cfg
	a.hash = newHash

	return nil
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
	All        bool
	Explicit   []string
	Additional map[string]string
}

// AllowedAuthForAll means auth for all repositories is allowed
func AllowedAuthForAll() AllowedAuthFor { return AllowedAuthFor{true, nil, nil} }

// AllowedAuthForNone means auth for no repositories is allowed
func AllowedAuthForNone() AllowedAuthFor { return AllowedAuthFor{false, nil, nil} }

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

	return AllowedAuthFor{a.All, append(a.Explicit, reference.Domain(pref)), a.Additional}
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
	authFor = AllowedAuthForNone()
	if auth == nil {
		return
	}

	switch ath := auth.Mode.(type) {
	case *api.BuildRegistryAuth_Total:
		if ath.Total.AllowAll {
			authFor = AllowedAuthForAll()
		} else {
			authFor = AllowedAuthForNone()
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
		authFor = AllowedAuthFor{false, explicit, nil}
	default:
		authFor = AllowedAuthForNone()
	}

	authFor.Additional = auth.Additional

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

	// If we haven't found authentication using the built-in way, we'll resort to additional auth
	// the user sent us.
	defer func() {
		if err == nil && res == nil {
			res = a.additionalAuth(reg)

			if res != nil {
				log.WithField("reg", reg).Debug("found additional auth")
			}
		}
	}()

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
		log.WithField("reg", reg).WithField("ref", ref).WithField("a", a).Error("registry not allowed - you may want to add this to the list of allowed registries in your installation config")
		return nil, nil
	}

	return auth.Authenticate(reg)
}

func (a AllowedAuthFor) additionalAuth(domain string) *Authentication {
	ath, ok := a.Additional[domain]
	if !ok {
		return nil
	}

	res := &Authentication{
		Auth: ath,
	}
	dec, err := base64.StdEncoding.DecodeString(ath)
	if err == nil {
		segs := strings.Split(string(dec), ":")
		if len(segs) > 1 {
			res.Username = segs[0]
			res.Password = strings.Join(segs[1:], ":")
		}
	}
	return res
}

// ImageBuildAuth is the format image builds needs
type ImageBuildAuth map[string]types.AuthConfig

// GetImageBuildAuthFor produces authentication in the format an image builds needs
func (a AllowedAuthFor) GetImageBuildAuthFor(blocklist []string) (res ImageBuildAuth) {
	res = make(ImageBuildAuth)
	for reg := range a.Additional {
		var blocked bool
		for _, blk := range blocklist {
			if blk == reg {
				blocked = true
				break
			}
		}
		if blocked {
			continue
		}
		ath := a.additionalAuth(reg)
		res[reg] = types.AuthConfig(*ath)
	}

	return
}
