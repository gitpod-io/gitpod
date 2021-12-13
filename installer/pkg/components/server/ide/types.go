// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package ide

// These types are from TypeScript files

// IDEConfig RawIDEConfig interface from components/server/src/ide-config.ts
type IDEConfig struct {
	// Deprecated
	IDEVersion string `json:"ideVersion"`
	// Deprecated
	IDEImageRepo string `json:"ideImageRepo"`
	// Deprecated
	IDEImageAliases map[string]string `json:"ideImageAliases"`
	// Deprecated
	DesktopIDEImageAliases map[string]string `json:"desktopIdeImageAliases"`
	SupervisorImage        string            `json:"supervisorImage"`
	IDEOptions             IDEOptions        `json:"ideOptions"`
}

// IDEOptions interface from components/gitpod-protocol/src/ide-protocol.ts
type IDEOptions struct {
	Options           map[string]IDEOption `json:"options"`
	DefaultIDE        string               `json:"defaultIde"`
	DefaultDesktopIDE string               `json:"defaultDesktopIde"`
}

// IDEOption interface from components/gitpod-protocol/src/ide-protocol.ts
type IDEOption struct {
	OrderKey           *string  `json:"orderKey,omitempty"`
	Title              string   `json:"title"`
	Type               string   `json:"type"`
	Logo               string   `json:"logo"`
	Tooltip            *string  `json:"tooltip,omitempty"`
	Label              *string  `json:"label,omitempty"`
	Notes              []string `json:"notes,omitempty"`
	Hidden             *bool    `json:"hidden,omitempty"`
	Image              string   `json:"image"`
	ResolveImageDigest *bool    `json:"resolveImageDigest,omitempty"`
}
