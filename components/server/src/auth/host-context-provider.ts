/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { HostContext } from './host-context';
import { AuthProviderParams } from './auth-provider';

export const HostContextProvider = Symbol('HostContextProvider');

export interface HostContextProvider {
  init(): Promise<void>;
  getAll(): HostContext[];
  get(hostname: string): HostContext | undefined;
  findByAuthProviderId(authProviderId: string): HostContext | undefined;
}

export const HostContextProviderFactory = Symbol('HostContextProviderFactory');

export interface HostContextProviderFactory {
  createHostContext: (config: AuthProviderParams) => HostContext | undefined;
}
