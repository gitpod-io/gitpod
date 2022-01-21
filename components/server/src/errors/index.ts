/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { User, Token } from '@gitpod/gitpod-protocol';

export interface NotFoundError extends Error {
  readonly data: NotFoundError.Data;
}
export namespace NotFoundError {
  export interface Data {
    readonly host: string;
    readonly owner: string;
    readonly repoName: string;
    readonly userScopes?: string[];
    readonly lastUpdate?: string;
  }
  export async function create(token: Token | undefined, user: User, host: string, owner: string, repoName: string) {
    const lastUpdate = token && token.updateDate;
    const userScopes = token ? [...token.scopes] : [];

    const userIsOwner = owner == user.name; // TODO: shouldn't this be a comparison with `identity.authName`?
    const data = <NotFoundError.Data>{ host, owner, repoName, userIsOwner, userScopes, lastUpdate };
    const error = Object.assign(new Error('NotFoundError'), { data });
    return error;
  }
  export function is(error: any): error is NotFoundError {
    return (
      !!error &&
      !!error.data &&
      !!error.data.host &&
      !!error.data.owner &&
      !!error.data.repoName &&
      error.message === 'NotFoundError'
    );
  }
}

export interface UnauthorizedError extends Error {
  readonly data: UnauthorizedError.Data;
}
export namespace UnauthorizedError {
  export interface Data {
    readonly host: string;
    readonly scopes: string[];
    readonly messageHint: string;
  }
  const message = 'UnauthorizedError';
  export function create(host: string, scopes: string[], messageHint?: string) {
    const data = <UnauthorizedError.Data>{ host, scopes, messageHint: messageHint || 'unauthorized' };
    const error = Object.assign(new Error(message), { data });
    return error;
  }
  export function is(error: any): error is UnauthorizedError {
    return (
      !!error &&
      !!error.data &&
      !!error.data.host &&
      !!error.data.scopes &&
      !!error.data.messageHint &&
      error.message === message
    );
  }
}
