// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.gitpodprotocol.api.entities;

public class TakeSnapshotOptions {
    private String workspaceId;
    private boolean dontWait;

    public TakeSnapshotOptions(final String workspaceId, final Boolean dontWait) {
        this.workspaceId = workspaceId;
        this.dontWait = dontWait;
    }

    public String getWorkspaceId() {
        return workspaceId;
    }

    public void setWorkspaceId(String workspaceId) {
        this.workspaceId = workspaceId;
    }

    public boolean isDontWait() {
        return dontWait;
    }

    public void setDontWait(boolean dontWait) {
        this.dontWait = dontWait;
    }
}
