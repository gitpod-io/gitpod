/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { AuthProviderEntry as AuthProviderEntry } from '@gitpod/gitpod-protocol';

export const AuthProviderEntryDB = Symbol('AuthProviderEntryDB');

export interface AuthProviderEntryDB {
  storeAuthProvider(ap: AuthProviderEntry): Promise<AuthProviderEntry>;

  delete(ap: AuthProviderEntry): Promise<void>;

  findAll(): Promise<AuthProviderEntry[]>;
  findByHost(host: string): Promise<AuthProviderEntry | undefined>;
  findByUserId(userId: string): Promise<AuthProviderEntry[]>;
}
