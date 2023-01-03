// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.gitpodprotocol.api.entities;

public class SetWorkspaceTimeoutResult {
    private String[] resetTimeoutOnWorkspaces;

    public SetWorkspaceTimeoutResult(String[] resetTimeoutOnWorkspaces) {
        this.resetTimeoutOnWorkspaces = resetTimeoutOnWorkspaces;
    }

    public String[] getResetTimeoutOnWorkspaces() {
        return resetTimeoutOnWorkspaces;
    }
}
