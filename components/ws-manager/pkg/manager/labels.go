// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package manager

const (
	// fullWorkspaceBackupLabel is set on workspaces which operate using a full workspace backup
	fullWorkspaceBackupLabel = "gitpod/fullWorkspaceBackup"

	// pvcWorkspaceFeatureLabel is set on workspaces which are using persistent_volume_claim feature
	pvcWorkspaceFeatureLabel = "gitpod.io/pvcFeature"
)
