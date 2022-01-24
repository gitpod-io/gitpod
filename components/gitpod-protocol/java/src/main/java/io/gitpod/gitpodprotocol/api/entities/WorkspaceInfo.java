// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.gitpodprotocol.api.entities;

public class WorkspaceInfo {
    private Workspace workspace;

    public Workspace getWorkspace() {
        return workspace;
    }

    public void setWorkspace(Workspace workspace) {
        this.workspace = workspace;
    }

    private WorkspaceInstance latestInstance;

    public WorkspaceInstance getLatestInstance() {
        return latestInstance;
    }

    public void setLatestInstance(WorkspaceInstance latestInstance) {
        this.latestInstance = latestInstance;
    }
}
