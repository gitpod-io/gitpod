/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { OAuthClient, OAuthScope, OAuthToken } from '@jmondi/oauth2-server';

/**
 * Currently (2021-05-15) we only support 1 client and a fixed set of scopes so hard-coding here is acceptable.
 * This will change in time, in which case we can move to using the DB.
 */
export interface InMemory {
    clients: { [id: string]: OAuthClient };
    tokens: { [id: string]: OAuthToken };
    scopes: { [id: string]: OAuthScope };
}

// Clients
const localAppClientID = 'gplctl-1.0';
const localClient: OAuthClient = {
    id: localAppClientID,
    secret: `${localAppClientID}-secret`,
    name: 'Gitpod local control client',
    // Set of valid redirect URIs
    // NOTE: these need to be kept in sync with the port range in the local app
    redirectUris: Array.from({ length: 10 }, (_, i) => 'http://127.0.0.1:' + (63110 + i)),
    allowedGrants: ['authorization_code'],
    scopes: [
        { name: 'function:getGitpodTokenScopes' },
        { name: 'function:getWorkspace' },
        { name: 'function:getWorkspaces' },
        { name: 'function:listenForWorkspaceInstanceUpdates' },
        { name: 'resource:default' },
    ],
};

const jetBrainsGateway: OAuthClient = {
    id: 'jetbrains-gateway-gitpod-plugin',
    name: 'JetBrains Gateway Gitpod Plugin',
    // Set of valid redirect URIs
    // NOTE: these need to be kept in sync with the port range in
    // https://github.com/JetBrains/intellij-community/blob/8f07b83138bcb8a98a031e4508080c849a735644/platform/built-in-server/src/org/jetbrains/builtInWebServer/BuiltInServerOptions.java#L34
    redirectUris: Array.from(
        { length: 20 },
        (_, i) => `http://127.0.0.1:${63342 + i}/api/gitpod/oauth/authorization_code`,
    ),
    allowedGrants: ['authorization_code'],
    scopes: [
        { name: 'function:getGitpodTokenScopes' },
        { name: 'function:getIDEOptions' },
        { name: 'function:getOwnerToken' },
        { name: 'function:getWorkspace' },
        { name: 'function:getWorkspaces' },
        { name: 'function:listenForWorkspaceInstanceUpdates' },
        { name: 'resource:default' },
    ],
};

export const inMemoryDatabase: InMemory = {
    clients: {
        [localClient.id]: localClient,
        [jetBrainsGateway.id]: jetBrainsGateway,
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
