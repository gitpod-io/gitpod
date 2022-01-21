/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import {
  GrantIdentifier,
  OAuthClient,
  OAuthClientRepository,
  OAuthScope,
  OAuthScopeRepository,
} from '@jmondi/oauth2-server';
import { inMemoryDatabase } from './db';

/**
 * Currently (2021-05-15) we only support 1 client and a fixed set of scopes so using in-memory here is acceptable.
 * This will change in time, in which case we can move to using the DB.
 */
export const inMemoryClientRepository: OAuthClientRepository = {
  async getByIdentifier(clientId: string): Promise<OAuthClient> {
    return inMemoryDatabase.clients[clientId];
  },

  async isClientValid(grantType: GrantIdentifier, client: OAuthClient, clientSecret?: string): Promise<boolean> {
    if (client.secret !== clientSecret) {
      log.warn(`isClientValid: bad secret`);
      return false;
    }

    if (!client.allowedGrants.includes(grantType)) {
      log.warn(`isClientValid: bad grant`);
      return false;
    }

    return true;
  },
};

export const inMemoryScopeRepository: OAuthScopeRepository = {
  async getAllByIdentifiers(scopeNames: string[]): Promise<OAuthScope[]> {
    return Object.values(inMemoryDatabase.scopes).filter((scope) => scopeNames.includes(scope.name));
  },
  async finalize(
    scopes: OAuthScope[],
    identifier: GrantIdentifier,
    client: OAuthClient,
    user_id?: string,
  ): Promise<OAuthScope[]> {
    return scopes;
  },
};
