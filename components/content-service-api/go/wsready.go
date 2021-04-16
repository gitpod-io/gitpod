// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package api

//go:generate sh generate.sh

// WorkspaceInitSource describes from which source a workspace was initialized
type WorkspaceInitSource string

const (
	// WorkspaceInitFromBackup means the workspace was initialized from one of its previous backups
	WorkspaceInitFromBackup WorkspaceInitSource = "from-backup"

	// WorkspaceInitFromPrebuild means the workspace was initialized from a prebuild
	WorkspaceInitFromPrebuild WorkspaceInitSource = "from-prebuild"

	// WorkspaceInitFromOther means the workspace was initialized from some other source, e.g. Git
	WorkspaceInitFromOther WorkspaceInitSource = "from-other"
)

// WorkspaceReadyMessage describes the content of a workspace-ready file in a workspace
type WorkspaceReadyMessage struct {
	Source WorkspaceInitSource `json:"source"`
}
