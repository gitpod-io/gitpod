// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package config

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
	// Experimental this IDE option is to only be shown to some users
	Experimental bool `json:"experimental,omitempty"`
	// Image ref to the IDE image.
	Image string `json:"image"`
	// LatestImage ref to the IDE image, this image ref always resolve to digest.
	LatestImage string `json:"latestImage,omitempty"`
	// ResolveImageDigest when this is `true`, the tag of this image is resolved to the latest image digest regularly.
	// This is useful if this image points to a tag like `nightly` that will be updated regularly. When `resolveImageDigest` is `true`, we make sure that we resolve the tag regularly to the most recent image version.
	ResolveImageDigest bool `json:"resolveImageDigest,omitempty"`
	// PluginImage ref for the IDE image, this image ref always resolve to digest.
	// DEPRECATED use ImageLayers instead
	PluginImage string `json:"pluginImage,omitempty"`
	// PluginLatestImage ref for the latest IDE image, this image ref always resolve to digest.
	// DEPRECATED use LatestImageLayers instead
	PluginLatestImage string `json:"pluginLatestImage,omitempty"`
	// ImageVersion the semantic version of the IDE image.
	ImageVersion string `json:"imageVersion,omitempty"`
	// LatestImageVersion the semantic version of the latest IDE image.
	LatestImageVersion string `json:"latestImageVersion,omitempty"`
	// ImageLayers for additional ide layers and dependencies
	ImageLayers []string `json:"imageLayers,omitempty"`
	// LatestImageLayers for latest additional ide layers and dependencies
	LatestImageLayers []string `json:"latestImageLayers,omitempty"`
}

type IDEClient struct {
	// DefaultDesktopIDE when the user has not specified one.
	DefaultDesktopIDE string `json:"defaultDesktopIDE,omitempty"`
	// DesktopIDEs supported by the client.
	DesktopIDEs []string `json:"desktopIDEs,omitempty"`
	// InstallationSteps to install the client on user machine.
	InstallationSteps []string `json:"installationSteps,omitempty"`
}
