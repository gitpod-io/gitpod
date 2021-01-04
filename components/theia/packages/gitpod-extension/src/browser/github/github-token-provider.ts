/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { MaybePromise } from '@theia/core/lib/common/types';

export const GitHubTokenProvider = Symbol('GitHubTokenProvider');

export interface GitHubTokenProvider {
    getToken(params: GetGitHubTokenParams): MaybePromise<string>;
}

export interface GetGitHubTokenParams {
    host: string;
    scopes?: string[];
    message?: string;
}
