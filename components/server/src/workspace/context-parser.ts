/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { WorkspaceContext, User } from '@gitpod/gitpod-protocol';
import { TraceContext } from '@gitpod/gitpod-protocol/lib/util/tracing';
import { inject, injectable } from 'inversify';
import { AuthProviderParams } from '../auth/auth-provider';
import { URLSearchParams, URL } from 'url';

export interface IContextParser {
    normalize?(contextUrl: string): string | undefined;
    canHandle(user: User, contextUrl: string): boolean;
    handle(ctx: TraceContext, user: User, contextUrl: string): Promise<WorkspaceContext>;
    fetchCommitHistory(
        ctx: TraceContext,
        user: User,
        contextUrl: string,
        commit: string,
        maxDepth: number,
    ): Promise<string[] | undefined>;
}
export const IContextParser = Symbol('IContextParser');

@injectable()
export abstract class AbstractContextParser implements IContextParser {
    @inject(AuthProviderParams) protected config: AuthProviderParams;

    protected get host(): string {
        return this.config.host;
    }

    public normalize(contextUrl: string): string | undefined {
        let url = contextUrl.trim();
        if (url.startsWith(`${this.host}/`)) {
            url = `https://${url}`;
        }
        if (url.startsWith(`git@${this.host}:`)) {
            return `https://${this.host}/` + url.slice(`git@${this.host}:`.length);
        }
        if (url.startsWith(`https://${this.host}/`)) {
            return url;
        }
        return undefined;
    }

    public canHandle(user: User, contextUrl: string): boolean {
        return this.normalize(contextUrl) !== undefined;
    }

    public async parseURL(user: User, contextUrl: string): Promise<URLParts> {
        const url = new URL(contextUrl);
        const pathname = url.pathname.replace(/^\//, '').replace(/\/$/, ''); // pathname without leading and trailing slash
        const segments = pathname.split('/');

        const host = this.host; // as per contract, cf. `canHandle(user, contextURL)`

        const lenghtOfRelativePath = host.split('/').length - 1; // e.g. "123.123.123.123/gitlab" => length of 1
        if (lenghtOfRelativePath > 0) {
            // remove segments from the path to be consider further, which belong to the relative location of the host
            // cf. https://github.com/gitpod-io/gitpod/issues/2637
            segments.splice(0, lenghtOfRelativePath);
        }

        var owner: string = segments[0];
        var repoName: string = segments[1];
        var moreSegmentsStart: number = 2;
        const endsWithRepoName = segments.length === moreSegmentsStart;
        const searchParams = url.searchParams;
        return {
            host,
            owner,
            repoName: this.parseRepoName(repoName, endsWithRepoName),
            moreSegments: endsWithRepoName ? [] : segments.slice(moreSegmentsStart),
            searchParams,
        };
    }

    protected parseRepoName(urlSegment: string, lastSegment: boolean): string {
        return lastSegment && urlSegment.endsWith('.git')
            ? urlSegment.substring(0, urlSegment.length - '.git'.length)
            : urlSegment;
    }

    public abstract handle(ctx: TraceContext, user: User, contextUrl: string): Promise<WorkspaceContext>;

    /**
     * Fetches the commit history of a commit (used to find a relevant parent prebuild for incremental prebuilds).
     *
     * @returns the linear commit history starting from (but excluding) the given commit, in the same order as `git log`
     */
    public abstract fetchCommitHistory(
        ctx: TraceContext,
        user: User,
        contextUrl: string,
        commit: string,
        maxDepth: number,
    ): Promise<string[] | undefined>;
}

export interface URLParts {
    host: string;
    owner: string;
    repoName: string;
    moreSegments: string[];
    searchParams: URLSearchParams;
}

/**
 * Prefix parser consume a segment of the context string, expect
 * the remainder to go through regular context parsing, and be returned
 * to them. For example, the prebuild context parser works that way: it
 * handles context strings like /prebuild/<othercontext>, consumes "prebuild"
 * and expects "othercontext" to be parsed and passed back.
 */
export interface IPrefixContextParser {
    normalize?(contextURL: string): string | undefined;
    findPrefix(user: User, context: string): string | undefined;
    handle(user: User, prefix: string, context: WorkspaceContext): Promise<WorkspaceContext>;
}
export const IPrefixContextParser = Symbol('IPrefixContextParser');

export namespace IssueContexts {
    export function toBranchName(user: User, issueTitle: string, issueNr: number): string {
        const titleWords = issueTitle
            .toLowerCase()
            .replace(/[^a-z]/g, '-')
            .split('-')
            .filter((w) => w.length > 0);
        let localBranch = (user.name + '/').toLowerCase();
        for (const segment of titleWords) {
            if (localBranch.length > 30) {
                break;
            }
            localBranch += segment + '-';
        }
        localBranch += issueNr;
        return localBranch;
    }
}
