// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package prerun

import "github.com/gitpod-io/gitpod/ws-deployment/pkg/common"

// InstallMonitoringPreruns represents preruns before installing
type InstallMonitoringPreruns struct {
	Cluster        *common.WorkspaceCluster
	ProjectContext *common.ProjectContext
	PreRuns        []*IPreRun
}

// CreatePreRuns creates a set of pre runs to be executed before actual installation of
// monitoring satellite. It populates the calling object's `PreRuns` field
func (gp *InstallMonitoringPreruns) CreatePreRuns() error {
	panic("I am not implemented yet!")
}
