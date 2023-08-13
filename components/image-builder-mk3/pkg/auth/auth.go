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
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/ecr"
	"github.com/docker/cli/cli/config/configfile"
	"github.com/docker/distribution/reference"
	"github.com/docker/docker/api/types"
	"github.com/sirupsen/logrus"
	"golang.org/x/xerrors"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/watch"
	"github.com/gitpod-io/gitpod/image-builder/api"
)

// RegistryAuthenticator can provide authentication for some registries
type RegistryAuthenticator interface {
	// Authenticate attempts to provide authentication for Docker registry access
	Authenticate(ctx context.Context, registry string) (auth *Authentication, err error)
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
func (a *DockerConfigFileAuth) Authenticate(ctx context.Context, registry string) (auth *Authentication, err error) {
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

// CompositeAuth returns the first non-empty authentication of any of its consitutents
type CompositeAuth []RegistryAuthenticator

func (ca CompositeAuth) Authenticate(ctx context.Context, registry string) (auth *Authentication, err error) {
	for _, ath := range ca {
		res, err := ath.Authenticate(ctx, registry)
		if err != nil {
			return nil, err
		}
		if !res.Empty() {
			return res, nil
		}
	}
	return &Authentication{}, nil
}

func NewECRAuthenticator(ecrc *ecr.Client) *ECRAuthenticator {
	return &ECRAuthenticator{
		ecrc: ecrc,
	}
}

type ECRAuthenticator struct {
	ecrc *ecr.Client

	ecrAuth                string
	ecrAuthLastRefreshTime time.Time
	ecrAuthLock            sync.Mutex
}

func (ath *ECRAuthenticator) Authenticate(ctx context.Context, registry string) (auth *Authentication, err error) {
	// TODO(cw): find better way to detect if ref is an ECR repo
	if !strings.Contains(registry, ".dkr.") || !strings.Contains(registry, ".amazonaws.com") {
		return nil, nil
	}

	ath.ecrAuthLock.Lock()
	defer ath.ecrAuthLock.Unlock()
	// ECR tokens are valid for 12h: https://docs.aws.amazon.com/AmazonECR/latest/APIReference/API_GetAuthorizationToken.html
	if time.Since(ath.ecrAuthLastRefreshTime) > 10*time.Hour {
		tknout, err := ath.ecrc.GetAuthorizationToken(ctx, &ecr.GetAuthorizationTokenInput{})
		if err != nil {
			return nil, err
		}
		if len(tknout.AuthorizationData) == 0 {
			return nil, fmt.Errorf("no ECR authorization data received")
		}

		pwd, err := base64.StdEncoding.DecodeString(aws.ToString(tknout.AuthorizationData[0].AuthorizationToken))
		if err != nil {
			return nil, err
		}

		ath.ecrAuth = string(pwd)
		ath.ecrAuthLastRefreshTime = time.Now()
		log.Debug("refreshed ECR token")
	}

	segs := strings.Split(ath.ecrAuth, ":")
	if len(segs) != 2 {
		return nil, fmt.Errorf("cannot understand ECR token. Expected 2 segments, got %d", len(segs))
	}
	return &Authentication{
		Username: segs[0],
		Password: segs[1],
		Auth:     base64.StdEncoding.EncodeToString([]byte(ath.ecrAuth)),
	}, nil
}

// Authentication represents docker usable authentication
type Authentication types.AuthConfig

func (a *Authentication) Empty() bool {
	if a == nil {
		return true
	}
	if a.Auth == "" && a.Password == "" {
		return true
	}
	return false
}

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
func (a AllowedAuthFor) GetAuthFor(ctx context.Context, auth RegistryAuthenticator, refstr string) (res *Authentication, err error) {
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
		if err != nil || (res != nil && (res.Auth != "" || res.Password != "")) {
			return
		}

		log.WithField("reg", reg).Debug("checking for additional auth")
		res = a.additionalAuth(reg)

		if res != nil {
			log.WithField("reg", reg).Debug("found additional auth")
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
		log.WithField("reg", reg).WithField("ref", ref).WithField("a", a).Warn("registry not allowed - you may want to add this to the list of allowed registries in your installation config")
		return nil, nil
	}

	return auth.Authenticate(ctx, reg)
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
func (a AllowedAuthFor) GetImageBuildAuthFor(ctx context.Context, auth RegistryAuthenticator, blocklist []string) (res ImageBuildAuth) {
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
		if ath.Empty() {
			continue
		}
		res[reg] = types.AuthConfig(*ath)
	}
	for _, reg := range a.Explicit {
		ath, err := auth.Authenticate(ctx, reg)
		if err != nil {
			// TODO(cw): swalloing this error is not the obvious choice. We have to weigh failing all workspace image builds because of
			// a single misconfiguration, vs essentially silently ignoring that misconfig.
			log.WithError(err).WithField("registry", reg).Warn("cannot add image build auth for explicit registry - image build might fail")
			continue
		}
		if ath.Empty() {
			continue
		}
		res[reg] = types.AuthConfig(*ath)
	}

	if log.Log.Logger.IsLevelEnabled(logrus.DebugLevel) {
		keys := make([]string, 0, len(res))
		for k := range res {
			keys = append(keys, k)
		}
		log.WithField("registries", trustedStrings(keys)).Debug("providing additional auth for image build")
	}

	return res
}

type trustedStrings []string

func (trustedStrings) IsTrustedValue() {}
