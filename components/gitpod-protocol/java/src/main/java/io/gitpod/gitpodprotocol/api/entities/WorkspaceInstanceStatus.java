// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.gitpodprotocol.api.entities;

public class WorkspaceInstanceStatus {
    private String phase;
    private String ownerToken;
    private WorkspaceInstanceConditions conditions;

    public String getPhase() {
        return phase;
    }

    public void setPhase(String phase) {
        this.phase = phase;
    }

    public String getOwnerToken() {
        return ownerToken;
    }

    public void setOwnerToken(String ownerToken) {
        this.ownerToken = ownerToken;
    }

    public WorkspaceInstanceConditions getConditions() {
        return conditions;
    }

    public void setConditions(WorkspaceInstanceConditions conditions) {
        this.conditions = conditions;
    }
}
