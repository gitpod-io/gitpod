/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { IPrefixContextParser } from './context-parser';
import { User, WorkspaceContext, WithReferrerContext } from '@gitpod/gitpod-protocol';
import { injectable } from 'inversify';

@injectable()
export class ReferrerPrefixParser implements IPrefixContextParser {
    private readonly prefix = /^\/?referrer:([^\/:]*)(?::([^\/]*))?\//;

    findPrefix(_: User, context: string): string | undefined {
        return this.prefix.exec(context)?.[0] || undefined;
    }

    async handle(_: User, prefix: string, context: WorkspaceContext): Promise<WorkspaceContext | WithReferrerContext> {
        const matches = this.prefix.exec(prefix);
        const referrer = matches?.[1];
        const referrerIde = matches?.[2];
        return referrer ? { ...context, referrer, referrerIde } : context;
    }
}
