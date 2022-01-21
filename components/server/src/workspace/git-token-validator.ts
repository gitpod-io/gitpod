/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { inject, injectable } from 'inversify';
import { HostContextProvider } from '../auth/host-context-provider';

export interface CheckWriteAccessResult {
  found: boolean;
  isPrivateRepo?: boolean;
  writeAccessToRepo?: boolean;
  mayWritePrivate?: boolean;
  mayWritePublic?: boolean;
  error?: any;
}

export interface IGitTokenValidatorParams {
  token: string;
  host: string;
  repoFullName: string;
}

export interface IGitTokenValidator {
  checkWriteAccess(params: IGitTokenValidatorParams): Promise<CheckWriteAccessResult | undefined>;
}

export const IGitTokenValidator = Symbol('IGitTokenValidator');

@injectable()
export class GitTokenValidator {
  @inject(HostContextProvider) hostContextProvider: HostContextProvider;

  async checkWriteAccess(params: IGitTokenValidatorParams): Promise<CheckWriteAccessResult | undefined> {
    return this.hostContextProvider.get(params.host)?.gitTokenValidator?.checkWriteAccess(params);
  }
}
