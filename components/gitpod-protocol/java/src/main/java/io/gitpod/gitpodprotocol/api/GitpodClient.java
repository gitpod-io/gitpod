// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.gitpodprotocol.api;

import io.gitpod.gitpodprotocol.api.entities.WorkspaceInstance;
import org.eclipse.lsp4j.jsonrpc.services.JsonNotification;

public class GitpodClient {

    private GitpodServer server;

    public void connect(GitpodServer server) {
        this.server = server;
    }

    public GitpodServer getServer() {
        if (this.server == null) {
            throw new IllegalStateException("not connected");
        }
        return this.server;
    }

    public void notifyConnect() {
    }

    @JsonNotification
    public void onInstanceUpdate(WorkspaceInstance instance) {

    }
}
