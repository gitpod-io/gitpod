// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.gitpodprotocol.api;

public class GitpodClientImpl implements GitpodClient {

    private GitpodServer server;

    @Override
    public void connect(GitpodServer server) {
        this.server = server;
    }

    @Override
    public GitpodServer server() {
        if (this.server == null) {
            throw new IllegalStateException("server is null");
        }
        return this.server;
    }
}
