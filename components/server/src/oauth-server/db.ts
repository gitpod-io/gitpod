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

// Scopes
const scopes: OAuthScope[] = [
  { name: 'function:getGitpodTokenScopes' },
  { name: 'function:getWorkspace' },
  { name: 'function:getWorkspaces' },
  { name: 'function:listenForWorkspaceInstanceUpdates' },
  { name: 'resource:default' },
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
  scopes,
};

export const inMemoryDatabase: InMemory = {
  clients: {
    [localClient.id]: localClient,
  },
  tokens: {},
  scopes: {},
};
for (const scope of scopes) {
  inMemoryDatabase.scopes[scope.name] = scope;
}
