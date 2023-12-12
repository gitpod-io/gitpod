/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { OAuthClient, OAuthScope, OAuthToken } from "@jmondi/oauth2-server";
import { ApiTokenScopePermission } from "../auth/api-token-v0";

/**
 * Currently (2021-05-15) we only support 1 client and a fixed set of scopes so hard-coding here is acceptable.
 * This will change in time, in which case we can move to using the DB.
 */
export interface InMemory {
    clients: { [id: string]: ApiTokenOAuthClient };
    tokens: { [id: string]: OAuthToken };
    scopes: { [id: string]: OAuthScope };
}
type ApiTokenOAuthClient = OAuthClient & { tokenScopes: (OAuthScope & { name: ApiTokenScopePermission })[] };

// Clients

const localAppClientID = "gplctl-1.0";
const localClient: ApiTokenOAuthClient = {
    id: localAppClientID,
    secret: `${localAppClientID}-secret`,
    name: "Gitpod local control client",
    // Set of valid redirect URIs
    // NOTE: these need to be kept in sync with the port range in the local app
    redirectUris: Array.from({ length: 10 }, (_, i) => "http://127.0.0.1:" + (63110 + i)),
    allowedGrants: ["authorization_code"],
    scopes: [
        { name: "function:getGitpodTokenScopes" },
        { name: "function:getWorkspace" },
        { name: "function:getWorkspaces" },
        { name: "function:listenForWorkspaceInstanceUpdates" },
        { name: "resource:default" },
    ],
    tokenScopes: [
        {
            name: "user_read",
        },
        {
            name: "organization_member",
        },
    ],
};

const localCliClientID = "gitpod-cli";
const localCli: ApiTokenOAuthClient = {
    id: localCliClientID,
    secret: `${localCliClientID}-secret`,
    name: "Gitpod CLI",
    // Set of valid redirect URIs
    // NOTE: these need to be kept in sync with the port range in the local app
    redirectUris: Array.from({ length: 10 }, (_, i) => "http://127.0.0.1:" + (63110 + i)),
    allowedGrants: ["authorization_code"],
    scopes: [
        { name: "function:listenForWorkspaceInstanceUpdates" },
        { name: "function:getGitpodTokenScopes" },
        { name: "function:getLoggedInUser" },
        { name: "function:accessCodeSyncStorage" },
        { name: "function:getOwnerToken" },
        { name: "function:getWorkspace" },
        { name: "function:getWorkspaces" },
        { name: "function:getSSHPublicKeys" },
        { name: "function:startWorkspace" },
        { name: "function:stopWorkspace" },
        { name: "function:deleteWorkspace" },
        { name: "function:getTeam" },
        { name: "function:getTeams" },
        { name: "function:getTeamMembers" },
        { name: "function:getTeamProjects" },
        { name: "function:createWorkspace" },
        { name: "function:getToken" },
        { name: "function:getSupportedWorkspaceClasses" },
        { name: "function:getIDEOptions" },
        { name: "resource:default" },
    ],
    tokenScopes: [
        {
            name: "user_read",
        },
        {
            name: "user_code_sync",
        },
        {
            name: "user_write_env_var",
        },
        {
            name: "workspace_owner",
        },
        {
            name: "organization_member",
        },
    ],
};

const jetBrainsGateway: ApiTokenOAuthClient = {
    id: "jetbrains-gateway-gitpod-plugin",
    name: "JetBrains Gateway Gitpod Plugin",
    // Set of valid redirect URIs
    // NOTE: these need to be kept in sync with the port range in
    // https://github.com/JetBrains/intellij-community/blob/8f07b83138bcb8a98a031e4508080c849a735644/platform/built-in-server/src/org/jetbrains/builtInWebServer/BuiltInServerOptions.java#L34
    redirectUris: Array.from(
        { length: 20 },
        (_, i) => `http://127.0.0.1:${63342 + i}/api/gitpod/oauth/authorization_code`,
    ),
    allowedGrants: ["authorization_code"],
    scopes: [
        { name: "function:getGitpodTokenScopes" },
        { name: "function:getIDEOptions" },
        { name: "function:getOwnerToken" },
        { name: "function:getWorkspace" },
        { name: "function:getWorkspaces" },
        { name: "function:listenForWorkspaceInstanceUpdates" },
        { name: "resource:default" },
    ],
    tokenScopes: [
        {
            name: "user_read",
        },
        {
            name: "organization_member",
        },
    ],
};

function createVSCodeClient(protocol: string, displayName: string): ApiTokenOAuthClient {
    return {
        id: `${protocol}-gitpod`,
        name: `${displayName}: Gitpod extension`,
        redirectUris: [protocol + "://gitpod.gitpod-desktop/complete-gitpod-auth"],
        allowedGrants: ["authorization_code"],
        scopes: [
            { name: "function:getGitpodTokenScopes" },
            { name: "function:getLoggedInUser" },
            { name: "function:accessCodeSyncStorage" },
            { name: "function:getOwnerToken" },
            { name: "function:getWorkspace" },
            { name: "function:getWorkspaces" },
            { name: "function:getSSHPublicKeys" },
            { name: "function:sendHeartBeat" },
            { name: "function:startWorkspace" },
            { name: "function:stopWorkspace" },
            { name: "function:deleteWorkspace" },
            { name: "resource:default" },
        ],
        tokenScopes: [
            {
                name: "user_read",
            },
            {
                name: "user_code_sync",
            },
            {
                name: "user_write_env_var",
            },
            {
                name: "workspace_owner",
            },
            {
                name: "organization_member",
            },
        ],
    };
}

const desktopClient: ApiTokenOAuthClient = {
    id: "gitpod-desktop",
    name: "Gitpod Desktop",
    redirectUris: ["gitpod://complete-auth"],
    allowedGrants: ["authorization_code"],
    scopes: [
        { name: "function:getGitpodTokenScopes" },
        { name: "function:getLoggedInUser" },
        { name: "function:accessCodeSyncStorage" },
        { name: "function:getOwnerToken" },
        { name: "function:getWorkspace" },
        { name: "function:getWorkspaces" },
        { name: "function:getSSHPublicKeys" },
        { name: "function:startWorkspace" },
        { name: "function:stopWorkspace" },
        { name: "function:deleteWorkspace" },
        { name: "function:getTeams" },
        { name: "function:getTeamMembers" },
        { name: "function:getTeamProjects" },
        { name: "function:createWorkspace" },
        { name: "function:getToken" },
        { name: "function:getSupportedWorkspaceClasses" },
        { name: "function:getIDEOptions" },
        { name: "resource:default" },
    ],
    tokenScopes: [
        {
            name: "user_read",
        },
        {
            name: "user_code_sync",
        },
        {
            name: "user_write_env_var",
        },
        {
            name: "workspace_owner",
        },
        {
            name: "organization_member",
        },
    ],
};

const vscode = createVSCodeClient("vscode", "VS Code");
const vscodeInsiders = createVSCodeClient("vscode-insiders", "VS Code Insiders");

const vscodium = createVSCodeClient("vscodium", "VSCodium");
const cursor = createVSCodeClient("cursor", "Cursor");

export const inMemoryDatabase: InMemory = {
    clients: {
        [localClient.id]: localClient,
        [localCli.id]: localCli,
        [jetBrainsGateway.id]: jetBrainsGateway,
        [vscode.id]: vscode,
        [vscodeInsiders.id]: vscodeInsiders,
        [vscodium.id]: vscodium,
        [cursor.id]: cursor,
        [desktopClient.id]: desktopClient,
    },
    tokens: {},
    scopes: {},
};
for (const clientId in inMemoryDatabase.clients) {
    const client = inMemoryDatabase.clients[clientId];
    for (const scope of client.scopes) {
        inMemoryDatabase.scopes[scope.name] = scope;
    }
}

export const inMemoryApiTokenDatabase: InMemory = {
    clients: {
        [localClient.id]: localClient,
        [localCli.id]: localCli,
        [jetBrainsGateway.id]: jetBrainsGateway,
        [vscode.id]: vscode,
        [vscodeInsiders.id]: vscodeInsiders,
        [vscodium.id]: vscodium,
        [cursor.id]: cursor,
        [desktopClient.id]: desktopClient,
    },
    tokens: {},
    scopes: {},
};
for (const clientId in inMemoryApiTokenDatabase.clients) {
    const client = inMemoryApiTokenDatabase.clients[clientId];
    client.scopes = client.tokenScopes; // replace with tokenScopes
    for (const scope of client.scopes) {
        inMemoryApiTokenDatabase.scopes[scope.name] = scope;
    }
}
