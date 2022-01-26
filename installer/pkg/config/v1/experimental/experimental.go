// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

// experimental bundles all internal bits of configuration for which we do not offer
// support. We use those flags internally to operate SaaS, but do not expect anyone
// outside of Gitpod to use.
//
// Changes in this section will NOT be backwards compatible change at will without prior notice.
// If you use any setting herein, you forfeit support from Gitpod.
package experimental

// Config contains all experimental configuration.
type Config struct {
	Workspace *WorkspaceConfig `json:"workspace"`
	WebApp    *WebAppConfig    `json:"webapp"`
	IDE       *IDEConfig       `json:"ide"`
}

type WorkspaceConfig struct {
	Stage string `json:"stage"`
}

type WebAppConfig struct {
}

type IDEConfig struct{}
