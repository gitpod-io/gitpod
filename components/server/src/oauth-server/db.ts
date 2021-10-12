/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { OAuthClient, OAuthScope, OAuthToken } from "@jmondi/oauth2-server";

/**
* Currently (2021-05-15) we only support 1 client and a fixed set of scopes so hard-coding here is acceptable.
* This will change in time, in which case we can move to using the DB.
*/
export interface InMemory {
  clients: { [id: string]: OAuthClient };
  tokens: { [id: string]: OAuthToken };
  scopes: { [id: string]: OAuthScope };
}

// Scopes
const localAppScopes: OAuthScope[] = [
  { name: "function:getGitpodTokenScopes" },
  { name: "function:getWorkspace" },
  { name: "function:getWorkspaces" },
  { name: "function:listenForWorkspaceInstanceUpdates" },
  { name: "resource:default" }
];

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
  scopes: localAppScopes,
}

function createVSCodeClient(protocol: 'vscode' | 'vscode-insiders'): OAuthClient {
  return {
    id: protocol + '-' + 'gitpod',
    name: `VS Code${protocol === 'vscode-insiders' ? ' Insiders' : ''}: Gitpod`,
    redirectUris: [protocol + '://gitpod.gitpod-desktop/complete-gitpod-auth'],
    allowedGrants: ['authorization_code'],
    scopes: [
      { name: "function:getGitpodTokenScopes" },
      { name: "function:accessCodeSyncStorage" },
      { name: "resource:default" }
    ],
  }
}

const vscode = createVSCodeClient('vscode');
const vscodeInsiders = createVSCodeClient('vscode-insiders');

export const inMemoryDatabase: InMemory = {
  clients: {
    [localClient.id]: localClient,
    [vscode.id]: vscode,
    [vscodeInsiders.id]: vscodeInsiders
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
