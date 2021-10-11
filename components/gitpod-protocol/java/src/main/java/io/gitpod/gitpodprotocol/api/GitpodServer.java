// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.gitpodprotocol.api;

import java.util.concurrent.CompletableFuture;

import org.eclipse.lsp4j.jsonrpc.services.JsonRequest;

import io.gitpod.gitpodprotocol.api.entities.SendHeartBeatOptions;
import io.gitpod.gitpodprotocol.api.entities.User;

public interface GitpodServer {
    @JsonRequest
    CompletableFuture<User> getLoggedInUser();

    @JsonRequest
    CompletableFuture<Void> sendHeartBeat(SendHeartBeatOptions options);
}
