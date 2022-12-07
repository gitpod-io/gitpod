// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package oci_tool

import (
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"time"

	"github.com/containerd/containerd/remotes"
	"github.com/containerd/containerd/remotes/docker"
	"github.com/docker/distribution/reference"
	ociv1 "github.com/opencontainers/image-spec/specs-go/v1"
)

func Resolve(ctx context.Context, ref string) (string, error) {
	newCtx, cancel := context.WithTimeout(ctx, time.Second*30)
	defer cancel()
	res := docker.NewResolver(docker.ResolverOptions{})

	name, desc, err := res.Resolve(newCtx, ref)
	if err != nil {
		return "", err
	}

	pref, err := reference.ParseNamed(name)
	if err != nil {
		return "", err
	}
	cref, err := reference.WithDigest(pref, desc.Digest)
	if err != nil {
		return "", err
	}
	return cref.String(), nil
}

func interactiveFetchManifestOrIndex(ctx context.Context, res remotes.Resolver, ref string) (name string, result *ociv1.Manifest, err error) {
	resolved, desc, err := res.Resolve(ctx, ref)
	if err != nil {
		return "", nil, fmt.Errorf("cannot resolve %v: %w", ref, err)
	}

	fetcher, err := res.Fetcher(ctx, resolved)
	if err != nil {
		return "", nil, err
	}

	in, err := fetcher.Fetch(ctx, desc)
	if err != nil {
		return "", nil, err
	}
	defer in.Close()
	buf, err := ioutil.ReadAll(in)
	if err != nil {
		return "", nil, err
	}

	var mf ociv1.Manifest
	err = json.Unmarshal(buf, &mf)
	if err != nil {
		return "", nil, fmt.Errorf("cannot unmarshal manifest: %w", err)
	}

	if mf.Config.Size != 0 {
		return resolved, &mf, nil
	}
	return "", nil, nil
}

func ResolveIDEVersion(ctx context.Context, ref string) (string, error) {
	newCtx, cancel := context.WithTimeout(ctx, time.Second*30)
	defer cancel()
	res := docker.NewResolver(docker.ResolverOptions{})

	name, mf, err := interactiveFetchManifestOrIndex(newCtx, res, ref)
	if err != nil {
		return "", err
	}

	fetcher, err := res.Fetcher(ctx, name)
	if err != nil {
		return "", err
	}

	cfgin, err := fetcher.Fetch(ctx, mf.Config)
	if err != nil {
		return "", err
	}
	defer cfgin.Close()

	var tmp ManifestJSON

	err = json.NewDecoder(cfgin).Decode(&tmp)
	if err != nil {
		return "", nil
	}
	return tmp.Config.Labels.Version, nil
}

type ManifestJSON struct {
	Config struct {
		Labels struct {
			Version string `json:"io.gitpod.ide.version"`
		} `json:"Labels"`
	} `json:"config"`
}
