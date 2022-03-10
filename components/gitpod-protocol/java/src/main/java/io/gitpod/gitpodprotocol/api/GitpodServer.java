// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.gitpodprotocol.api;

import io.gitpod.gitpodprotocol.api.entities.*;
import org.eclipse.lsp4j.jsonrpc.services.JsonRequest;

import java.util.List;
import java.util.concurrent.CompletableFuture;

public interface GitpodServer {
    @JsonRequest
    CompletableFuture<User> getLoggedInUser();

    @JsonRequest
    CompletableFuture<Void> sendHeartBeat(SendHeartBeatOptions options);

    @JsonRequest
    CompletableFuture<Void> trackEvent(RemoteTrackMessage event);

    @JsonRequest
    CompletableFuture<List<String>> getGitpodTokenScopes(String tokenHash);

    @JsonRequest
    CompletableFuture<WorkspaceInfo> getWorkspace(String workspaceId);

    @JsonRequest
    CompletableFuture<String> getOwnerToken(String workspaceId);

    @JsonRequest
    CompletableFuture<List<WorkspaceInfo>> getWorkspaces(GetWorkspacesOptions options);

    @JsonRequest
    CompletableFuture<IDEOptions> getIDEOptions();
}
