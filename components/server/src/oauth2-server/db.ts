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

  flush(): void;
}

export const localAppClientID = 'gplctl-1.0';
const getWorkspaceScope: OAuthScope = { name: "function:getWorkspace" };
const localClient: OAuthClient = {
  id: localAppClientID,
  secret: `${localAppClientID}-secret`,
  name: 'Gitpod local control client',
  // TODO(rl) - allow port range/external specification
  redirectUris: ['http://localhost:64110'],
  allowedGrants: ['authorization_code'],
  scopes: [getWorkspaceScope],
}

export const inMemoryDatabase: InMemory = {
  clients: {
    [localClient.id]: localClient,
  },
  tokens: {},
  scopes: { [getWorkspaceScope.name]: getWorkspaceScope },
  flush() {
    this.clients = {};
    this.tokens = {};
    this.scopes = {};
  },
};
