// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package oci_tool

import (
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"strings"
	"time"

	"github.com/containerd/containerd/remotes"
	"github.com/containerd/containerd/remotes/docker"
	"github.com/docker/distribution/reference"
	ociv1 "github.com/opencontainers/image-spec/specs-go/v1"
	"golang.org/x/xerrors"
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

func ResolveIDEVersion(ctx context.Context, ref string, blobserveURL string) (string, error) {
	manifest, err := ResolveIDEManifest(ctx, ref, blobserveURL)
	if err != nil {
		return "", err
	}
	return manifest.Version, nil
}

func ResolveIDEManifest(ctx context.Context, ref string, blobserveURL string) (*IDEManifest, error) {
	labels, err := resolveIDELabels(ctx, ref)
	if err != nil {
		return nil, xerrors.Errorf("cannot resolve image labels: %w", err)
	}
	manifest := &IDEManifest{}
	if labels.Version != "" {
		manifest.Version = labels.Version
	}
	if labels.Manifest != "" {
		err = json.Unmarshal([]byte(labels.Manifest), manifest)
		if err != nil {
			return nil, xerrors.Errorf("cannot unmarshal IDE manifest: %w", err)
		}
	}
	if manifest.Name == "" {
		name := ref
		end := strings.LastIndex(name, "@")
		if end != -1 {
			name = name[:end]
		}
		end = strings.LastIndex(name, ":")
		if end == -1 {
			end = len(name)
		}
		begin := strings.LastIndex(name, "/")
		manifest.Name = ref[begin+1 : end]
	}
	if manifest.Kind != "browser" && manifest.Kind != "desktop" {
		manifest.Kind = "desktop"
	}
	if manifest.Title == "" {
		manifest.Title = manifest.Name
	}
	manifest.Icon = resolveIcon(blobserveURL, ref, manifest)
	return manifest, err
}

func resolveIcon(blobserveURL string, ref string, manifest *IDEManifest) string {
	if manifest.Icon == "" {
		return ""
	}
	path := manifest.Icon
	if !strings.HasPrefix(manifest.Icon, "/") {
		path = "/" + path
	}
	return fmt.Sprintf("%s/%s%s%s",
		blobserveURL,
		ref,
		"/__files__",
		path,
	)
}

func resolveIDELabels(ctx context.Context, ref string) (*IDELabels, error) {
	newCtx, cancel := context.WithTimeout(ctx, time.Second*30)
	defer cancel()
	res := docker.NewResolver(docker.ResolverOptions{})

	name, mf, err := interactiveFetchManifestOrIndex(newCtx, res, ref)
	if err != nil {
		return nil, err
	}

	fetcher, err := res.Fetcher(ctx, name)
	if err != nil {
		return nil, err
	}

	cfgin, err := fetcher.Fetch(ctx, mf.Config)
	if err != nil {
		return nil, err
	}
	defer cfgin.Close()

	var tmp ManifestJSON

	err = json.NewDecoder(cfgin).Decode(&tmp)
	if err != nil {
		return nil, nil
	}
	return &tmp.Config.Labels, nil
}

type IDELabels struct {
	Version  string `json:"io.gitpod.ide.version,omitempty"`
	Manifest string `json:"io.gitpod.ide.manifest,omitempty"`
}

/*
	{
	    "name": "xterm",
	    "kind": "browser",
	    "version": "1.0.0",
	    "title": "Terminal",
	    "icon": "terminal.svg"
	}
*/
type IDEManifest struct {
	Name    string `json:"name,omitempty"`
	Kind    string `json:"kind,omitempty"`
	Version string `json:"version,omitempty"`
	Title   string `json:"title,omitempty"`
	Icon    string `json:"icon,omitempty"`
}

type ManifestJSON struct {
	Config struct {
		Labels IDELabels `json:"Labels"`
	} `json:"config"`
}
