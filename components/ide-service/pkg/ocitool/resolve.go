// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package oci_tool

import (
	"context"
	"time"

	"github.com/containerd/containerd/remotes/docker"
	"github.com/docker/distribution/reference"
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
