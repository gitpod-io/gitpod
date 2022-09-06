// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package server

import (
	"context"
	_ "embed"
	"encoding/json"
	"fmt"

	"github.com/gitpod-io/gitpod/common-go/log"
	oci_tool "github.com/gitpod-io/gitpod/ide-service/pkg/ocitool"
	"github.com/xeipuuv/gojsonschema"
	"golang.org/x/xerrors"
)

type IDEType string

const (
	IDETypeBrowser IDEType = "browser"
	IDETypeDesktop IDEType = "desktop"
)

type IDEConfig struct {
	SupervisorImage string     `json:"supervisorImage"`
	IdeOptions      IDEOptions `json:"ideOptions"`
}

type IDEOptions struct {
	// Options is a list of available IDEs.
	Options map[string]IDEOption `json:"options"`
	// DefaultIde when the user has not specified one.
	DefaultIde string `json:"defaultIde"`
	// DefaultDesktopIde when the user has not specified one.
	DefaultDesktopIde string `json:"defaultDesktopIde"`
	// Clients specific IDE options.
	Clients map[string]IDEClient `json:"clients"`
}

type IDEOption struct {
	// OrderKey to ensure a stable order one can set an `orderKey`.
	OrderKey string `json:"orderKey,omitempty"`
	// Title with human readable text of the IDE (plain text only).
	Title string `json:"title"`
	// Type of the IDE, currently 'browser' or 'desktop'.
	Type IDEType `json:"type"`
	// Logo URL for the IDE. See also components/ide-proxy/static/image/ide-log/ folder
	Logo string `json:"logo"`
	// Tooltip plain text only
	Tooltip string `json:"tooltip,omitempty"`
	// Label is next to the IDE option like “Browser” (plain text only).
	Label string `json:"label,omitempty"`
	// Notes to the IDE option that are rendered in the preferences when a user chooses this IDE.
	Notes []string `json:"notes,omitempty"`
	// Hidden this IDE option is not visible in the IDE preferences.
	Hidden bool `json:"hidden,omitempty"`
	// Image ref to the IDE image.
	Image string `json:"image"`
	// LatestImage ref to the IDE image, this image ref always resolve to digest.
	LatestImage string `json:"latestImage,omitempty"`
	// ResolveImageDigest when this is `true`, the tag of this image is resolved to the latest image digest regularly.
	// This is useful if this image points to a tag like `nightly` that will be updated regularly. When `resolveImageDigest` is `true`, we make sure that we resolve the tag regularly to the most recent image version.
	ResolveImageDigest bool `json:"resolveImageDigest,omitempty"`
	// PluginImage ref for the IDE image, this image ref always resolve to digest.
	PluginImage string `json:"pluginImage,omitempty"`
	// PluginLatestImage ref for the latest IDE image, this image ref always resolve to digest.
	PluginLatestImage string `json:"pluginLatestImage,omitempty"`
}

type IDEClient struct {
	// DefaultDesktopIDE when the user has not specified one.
	DefaultDesktopIDE string `json:"defaultDesktopIDE,omitempty"`
	// DesktopIDEs supported by the client.
	DesktopIDEs []string `json:"desktopIDEs,omitempty"`
	// InstallationSteps to install the client on user machine.
	InstallationSteps []string `json:"installationSteps,omitempty"`
}

//go:embed schema.json
var jsonScheme []byte

// ParseConfig parse and validate ide config
func ParseConfig(ctx context.Context, b []byte) (*IDEConfig, error) {
	var config IDEConfig
	if err := json.Unmarshal(b, &config); err != nil {
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

	if err := config.checkIDEExistsInOptions(config.IdeOptions.DefaultIde, IDETypeBrowser, "DefaultIde"); err != nil {
		return nil, err
	}
	if err := config.checkIDEExistsInOptions(config.IdeOptions.DefaultDesktopIde, IDETypeDesktop, "DefaultDesktopIde"); err != nil {
		return nil, err
	}

	for clientId, client := range config.IdeOptions.Clients {
		if err := config.checkIDEExistsInOptions(client.DefaultDesktopIDE, IDETypeDesktop, fmt.Sprintf("client %s DefaultDesktopIDE", clientId)); err != nil {
			return nil, err
		}
		for _, ideId := range client.DesktopIDEs {
			if err := config.checkIDEExistsInOptions(ideId, IDETypeDesktop, fmt.Sprintf("client %s DesktopIDEs %s", clientId, ideId)); err != nil {
				return nil, err
			}
		}
	}

	// resolve image digest
	for id, option := range config.IdeOptions.Options {
		if option.ResolveImageDigest {
			if resolved, err := oci_tool.Resolve(ctx, option.Image); err != nil {
				log.WithError(err).Error("ide config: cannot resolve image digest")
			} else {
				log.WithField("ide", id).WithField("image", option.Image).WithField("resolved", resolved).Info("ide config: resolved latest image digest")
				option.Image = resolved
			}
		}
		if option.LatestImage != "" {
			if resolved, err := oci_tool.Resolve(ctx, option.LatestImage); err != nil {
				log.WithError(err).Error("ide config: cannot resolve latest image digest")
			} else {
				log.WithField("ide", id).WithField("image", option.LatestImage).WithField("resolved", resolved).Info("ide config: resolved latest image digest")
				option.LatestImage = resolved
			}
		}
		config.IdeOptions.Options[id] = option
	}

	return &config, nil
}

func (c *IDEConfig) checkIDEExistsInOptions(ideId string, ideType IDEType, name string) error {
	ide, ok := c.IdeOptions.Options[ideId]
	if !ok {
		return xerrors.Errorf("invalid ide config: %s %s is not an entry of ide options", name, ideId)
	}
	if ide.Type != ideType {
		return xerrors.Errorf("invalid ide config: %s should be %s but %s", name, ideType, ide.Type)
	}
	return nil
}
