/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { OAuthAuthCode } from "@jmondi/oauth2-server";
import { OAuthClient } from "@jmondi/oauth2-server";
import { OAuthScope } from "@jmondi/oauth2-server";
import { OAuthToken } from "@jmondi/oauth2-server";
import { OAuthUser } from "@jmondi/oauth2-server";

export interface InMemory {
  users: { [id: string]: OAuthUser };
  clients: { [id: string]: OAuthClient };
  authCodes: { [id: string]: OAuthAuthCode };
  tokens: { [id: string]: OAuthToken };
  scopes: { [id: string]: OAuthScope };

  flush(): void;
}

const getWorkspaceScope: OAuthScope = { name: "function:getWorkspace" };
const localClient: OAuthClient = {
  id: 'gplctl-1.0',
  name: 'Gitpod local control client',
  redirectUris: [],
  allowedGrants: ['client_credentials'],
  scopes: [getWorkspaceScope]
}
const rl: OAuthUser = {
  id: 'rl-gitpod',
  email: 'someone@example.com',
}

export const inMemoryDatabase: InMemory = {
  clients: {
    [localClient.id]: localClient,
  },
  authCodes: {},
  tokens: {},
  scopes: { [getWorkspaceScope.name]: getWorkspaceScope },
  users: { [rl.id]: rl },
  flush() {
    this.clients = {};
    this.authCodes = {};
    this.tokens = {};
    this.scopes = {};
    this.users = {};
  },
};

// beforeEach(() => {
//   inMemoryDatabase.flush();
// });