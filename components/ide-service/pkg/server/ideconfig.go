// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package server

import (
	"context"
	_ "embed"
	"encoding/json"
	"fmt"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/ide-service-api/config"
	oci_tool "github.com/gitpod-io/gitpod/ide-service/pkg/ocitool"
	"github.com/xeipuuv/gojsonschema"
	"golang.org/x/xerrors"
)

//go:embed schema.json
var jsonScheme []byte

// ParseConfig parse and validate ide config
func ParseConfig(ctx context.Context, b []byte) (*config.IDEConfig, error) {
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
		if err := checkIDEExistsInOptions(cfg, client.DefaultDesktopIDE, config.IDETypeDesktop, fmt.Sprintf("client %s DefaultDesktopIDE", clientId)); err != nil {
			return nil, err
		}
		for _, ideId := range client.DesktopIDEs {
			if err := checkIDEExistsInOptions(cfg, ideId, config.IDETypeDesktop, fmt.Sprintf("client %s DesktopIDEs %s", clientId, ideId)); err != nil {
				return nil, err
			}
		}
	}

	// resolve image digest
	for id, option := range cfg.IdeOptions.Options {
		if option.ResolveImageDigest {
			if resolved, err := oci_tool.Resolve(ctx, option.Image); err != nil {
				log.WithError(err).Error("ide config: cannot resolve image digest")
			} else {
				log.WithField("ide", id).WithField("image", option.Image).WithField("resolved", resolved).Info("ide config: resolved latest image digest")
				option.Image = resolved
			}
		}
		if resolvedLabels, err := oci_tool.ResolveIDEVersion(ctx, option.Image); err != nil {
			log.WithError(err).Error("ide config: cannot get version from image")
		} else {
			option.ImageVersion = resolvedLabels.Version
			if resolvedLabels.Commit != nil {
				option.ImageCommit = *resolvedLabels.Commit
			}
		}
		if option.LatestImage != "" {
			if resolved, err := oci_tool.Resolve(ctx, option.LatestImage); err != nil {
				log.WithError(err).Error("ide config: cannot resolve latest image digest")
			} else {
				log.WithField("ide", id).WithField("image", option.LatestImage).WithField("resolved", resolved).Info("ide config: resolved latest image digest")
				option.LatestImage = resolved
			}
			if resolvedLabels, err := oci_tool.ResolveIDEVersion(ctx, option.LatestImage); err != nil {
				log.WithError(err).Error("ide config: cannot get version from image")
			} else {
				option.LatestImageVersion = resolvedLabels.Version
				if resolvedLabels.Commit != nil {
					option.LatestImageCommit = *resolvedLabels.Commit
				}
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
