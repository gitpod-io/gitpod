// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package server

import (
	"context"
	_ "embed"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/ide-service-api/config"
	oci_tool "github.com/gitpod-io/gitpod/ide-service/pkg/ocitool"
	"github.com/xeipuuv/gojsonschema"
	"golang.org/x/xerrors"
)

//go:embed schema.json
var jsonScheme []byte

// parseConfig parse and validate ide config
func (s *IDEServiceServer) parseConfig(ctx context.Context, b []byte) (*config.IDEConfig, error) {
	var cfg config.IDEConfig
	if err := json.Unmarshal(b, &cfg); err != nil {
		return nil, xerrors.Errorf("cannot parse ide config: %w", err)
	}

	// validate with json schema
	schemaLoader := gojsonschema.NewBytesLoader(jsonScheme)
	documentLoader := gojsonschema.NewBytesLoader(b)

	result, err := gojsonschema.Validate(schemaLoader, documentLoader)
	if err != nil {
		return nil, xerrors.Errorf("invalid: %w", err)
	}

	if !result.Valid() {
		log.Error("invalid ide config")
		for _, desc := range result.Errors() {
			log.WithField("desc", desc).Error("invalid ide config desc")
		}
		return nil, xerrors.New("invalid ide config")
	}

	if err := checkIDEExistsInOptions(cfg, cfg.IdeOptions.DefaultIde, config.IDETypeBrowser, "DefaultIde"); err != nil {
		return nil, err
	}
	if err := checkIDEExistsInOptions(cfg, cfg.IdeOptions.DefaultDesktopIde, config.IDETypeDesktop, "DefaultDesktopIde"); err != nil {
		return nil, err
	}

	for clientId, client := range cfg.IdeOptions.Clients {
		if client.DefaultDesktopIDE != "" {
			if err := checkIDEExistsInOptions(cfg, client.DefaultDesktopIDE, config.IDETypeDesktop, fmt.Sprintf("client %s DefaultDesktopIDE", clientId)); err != nil {
				return nil, err
			}
		}
		for _, ideId := range client.DesktopIDEs {
			if err := checkIDEExistsInOptions(cfg, ideId, config.IDETypeDesktop, fmt.Sprintf("client %s DesktopIDEs %s", clientId, ideId)); err != nil {
				return nil, err
			}
		}
	}

	// resolve image digest
	for id, option := range cfg.IdeOptions.Options {
		option.Source = "default"
		option.SourceRef = option.Image
		if option.ResolveImageDigest {
			if resolved, err := s.resolveIDEImage(ctx, option.Image); err != nil {
				log.WithError(err).Error("ide config: cannot resolve image digest")
			} else {
				log.WithField("ide", id).WithField("image", option.Image).WithField("resolved", resolved).Info("ide config: resolved latest image digest")
				option.Image = resolved
			}
		}
		if resolvedVersion, err := s.resolveIDEVersion(ctx, option.Image); err != nil {
			log.WithError(err).Error("ide config: cannot get version from image")
		} else {
			option.ImageVersion = resolvedVersion
		}
		if option.LatestImage != "" {
			option.LatestSourceRef = option.LatestImage
			if resolved, err := s.resolveIDEImage(ctx, option.LatestImage); err != nil {
				log.WithError(err).Error("ide config: cannot resolve latest image digest")
			} else {
				log.WithField("ide", id).WithField("image", option.LatestImage).WithField("resolved", resolved).Info("ide config: resolved latest image digest")
				option.LatestImage = resolved
			}
			if resolvedVersion, err := s.resolveIDEVersion(ctx, option.LatestImage); err != nil {
				log.WithError(err).Error("ide config: cannot get version from image")
			} else {
				option.LatestImageVersion = resolvedVersion
			}
		}
		cfg.IdeOptions.Options[id] = option
	}

	return &cfg, nil
}

func checkIDEExistsInOptions(c config.IDEConfig, ideId string, ideType config.IDEType, name string) error {
	ide, ok := c.IdeOptions.Options[ideId]
	if !ok {
		return xerrors.Errorf("invalid ide config: %s %s is not an entry of ide options", name, ideId)
	}
	if ide.Type != ideType {
		return xerrors.Errorf("invalid ide config: %s should be %s but %s", name, ideType, ide.Type)
	}
	return nil
}

func (s *IDEServiceServer) resolveIDEOption(ctx context.Context, sourceRef string, source string) (*config.IDEOption, error) {
	image, err := s.resolveIDEImage(ctx, sourceRef)
	if err != nil {
		return nil, xerrors.Errorf("cannot resolve image digest: %w", err)
	}
	manifest, err := s.resolveIDEManifest(ctx, image)
	if err != nil {
		return nil, err
	}
	imageVersion := manifest.Version

	var latestImage, latestSourceRef, latestImageVersion string
	if manifest.Latest != "" && manifest.Latest != sourceRef {
		latestSourceRef = manifest.Latest
		latestImage, err = s.resolveIDEImage(ctx, latestSourceRef)
		if err != nil {
			return nil, xerrors.Errorf("cannot resolve image digest: %w", err)
		}
		latestImageVersion, err = s.resolveIDEVersion(ctx, latestImage)
		if err != nil {
			return nil, xerrors.Errorf("cannot resolve image version: %w", err)
		}
	} else {
		latestSourceRef = sourceRef
		latestImage = image
		latestImageVersion = imageVersion
	}
	return &config.IDEOption{
		Source: source,

		SourceRef:    sourceRef,
		Image:        image,
		ImageVersion: imageVersion,

		LatestSourceRef:    latestSourceRef,
		LatestImage:        latestImage,
		LatestImageVersion: latestImageVersion,

		Name:  manifest.Name,
		Type:  config.IDEType(manifest.Kind),
		Title: manifest.Title,
		Logo:  manifest.Icon,
	}, nil
}

func (s *IDEServiceServer) resolveIDEVersion(ctx context.Context, ref string) (string, error) {
	manifest, err := s.resolveIDEManifest(ctx, ref)
	if err != nil {
		return "", err
	}
	return manifest.Version, nil
}

/*
	{
	    "name": "xterm",
	    "kind": "browser",
	    "version": "1.0.0",
	    "title": "Terminal",
	    "icon": "terminal.svg"
		"latest": "docker.io/gitpod/xterm:latest"
	}
*/
type IDEManifest struct {
	Name    string `json:"name,omitempty"`
	Kind    string `json:"kind,omitempty"`
	Version string `json:"version,omitempty"`
	Title   string `json:"title,omitempty"`
	Icon    string `json:"icon,omitempty"`
	Latest  string `json:"latest,omitempty"`
}

// TOOD evict on memory limit, maybe use reddis better to share between both instances of ide service
func (s *IDEServiceServer) resolveIDEImage(ctx context.Context, ref string) (string, error) {
	cacheItem, _ := s.cache.Value(ref)
	if cacheItem != nil {
		image, ok := cacheItem.Data().(string)
		if ok {
			return image, nil
		}
		err, ok := cacheItem.Data().(error)
		if ok {
			return "", err
		}
	}
	image, err := oci_tool.Resolve(ctx, ref)
	if err != nil {
		s.cache.Add(ref, 10*time.Minute, err)
		return "", err
	}
	s.cache.Add(ref, 10*time.Minute, image)
	return image, nil
}

// TOOD evict on memory limit, maybe use reddis better to share between both instances of ide service
func (s *IDEServiceServer) resolveIDEManifest(ctx context.Context, ref string) (*IDEManifest, error) {
	cacheItem, _ := s.cache.Value(ref)
	if cacheItem != nil {
		m, ok := cacheItem.Data().(*IDEManifest)
		if ok {
			return m, nil
		}
	}
	m, err := s.doResolveIDEManifest(ctx, ref)
	if err != nil {
		return nil, err
	}
	s.cache.Add(ref, 24*time.Hour, m)
	return m, nil
}

func (s *IDEServiceServer) doResolveIDEManifest(ctx context.Context, ref string) (*IDEManifest, error) {
	labels, err := oci_tool.ResolveIDELabels(ctx, ref)
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
	manifest.Icon = s.resolveIcon(ref, manifest)
	return manifest, err
}

func (s *IDEServiceServer) resolveIcon(ref string, manifest *IDEManifest) string {
	if manifest.Icon == "" {
		return ""
	}
	path := manifest.Icon
	if !strings.HasPrefix(manifest.Icon, "/") {
		path = "/" + path
	}
	return fmt.Sprintf("%s/%s%s%s",
		s.config.BlobserveURL,
		ref,
		"/__files__",
		path,
	)
}
