/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { OAuthClient, OAuthScope, OAuthToken } from "@jmondi/oauth2-server";
import { ScopedResourceGuard } from "../auth/resource-access";

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

// Scopes
const getWorkspaceScope: OAuthScope = { name: "function:getWorkspace" };
const listenForWorkspaceInstanceUpdatesScope: OAuthScope = { name: "function:listenForWorkspaceInstanceUpdates" };
const getWorkspaceResourceScope: OAuthScope = { name: "resource:" + ScopedResourceGuard.marshalResourceScope({ kind: "workspace", subjectID: "*", operations: ["get"] }) };
const getWorkspaceInstanceResourceScope: OAuthScope = { name: "resource:" + ScopedResourceGuard.marshalResourceScope({ kind: "workspaceInstance", subjectID: "*", operations: ["get"] }) };

// Clients
export const localAppClientID = 'gplctl-1.0';
const localClient: OAuthClient = {
  id: localAppClientID,
  secret: `${localAppClientID}-secret`,
  name: 'Gitpod local control client',
  // TODO(rl) - allow port range/external specification
  redirectUris: ['http://localhost:64110'],
  allowedGrants: ['authorization_code'],
  scopes: [getWorkspaceScope, listenForWorkspaceInstanceUpdatesScope, getWorkspaceResourceScope, getWorkspaceInstanceResourceScope],
}

export const inMemoryDatabase: InMemory = {
  clients: {
    [localClient.id]: localClient,
  },
  tokens: {},
  scopes: {
    [getWorkspaceScope.name]: getWorkspaceScope,
    [listenForWorkspaceInstanceUpdatesScope.name]: listenForWorkspaceInstanceUpdatesScope,
    [getWorkspaceResourceScope.name]: getWorkspaceResourceScope,
    [getWorkspaceInstanceResourceScope.name]: getWorkspaceInstanceResourceScope,
  },
  flush() {
    log.info('flush')
    this.clients = {};
    this.tokens = {};
    this.scopes = {};
  },
};
