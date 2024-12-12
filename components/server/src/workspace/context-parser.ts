/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { WorkspaceContext, User } from "@gitpod/gitpod-protocol";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { inject, injectable } from "inversify";
import { AuthProviderParams } from "../auth/auth-provider";
import { URLSearchParams, URL } from "url";

export interface IContextParser {
    normalize?(contextUrl: string): string | undefined;
    canHandle(user: User, contextUrl: string): boolean;
    handle(ctx: TraceContext, user: User, contextUrl: string): Promise<WorkspaceContext>;
}
export const IContextParser = Symbol("IContextParser");

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
        const pathname = url.pathname.replace(/^\//, "").replace(/\/$/, ""); // pathname without leading and trailing slash
        const segments = pathname.split("/");

        const host = this.host; // as per contract, cf. `canHandle(user, contextURL)`

        const lengthOfRelativePath = host.split("/").length - 1; // e.g. "123.123.123.123/gitlab" => length of 1
        if (lengthOfRelativePath > 0) {
            // remove segments from the path to be consider further, which belong to the relative location of the host
            // cf. https://github.com/gitpod-io/gitpod/issues/2637
            segments.splice(0, lengthOfRelativePath);
        }

        const owner: string = segments[0];
        const repoName: string = segments[1];
        const moreSegmentsStart: number = 2;
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
        return lastSegment && urlSegment.endsWith(".git")
            ? urlSegment.substring(0, urlSegment.length - ".git".length)
            : urlSegment;
    }

    public abstract handle(ctx: TraceContext, user: User, contextUrl: string): Promise<WorkspaceContext>;
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
export const IPrefixContextParser = Symbol("IPrefixContextParser");

// See https://www.kernel.org/pub/software/scm/git/docs/git-check-ref-format.html
// the magic sequence @{, consecutive dots, leading and trailing dot, ref ending in .lock
// Adapted from https://github.com/desktop/desktop/blob/1e3df9608a834dabdabe793b1b538e334f33c8a1/app/src/lib/sanitize-ref-name.ts
const invalidCharacterRegex = /[\x00-\x20\x7F~^:?*\[\\|""]+|@{|\.\.+|^\.|\.$|\.lock$|\/$/g;

/** Sanitize a proposed reference name by replacing illegal characters. */
function sanitizedRefName(name: string): string {
    return name.replace(invalidCharacterRegex, "-").replace(/^[-\+]*/g, "");
}

export namespace IssueContexts {
    export const maxBaseBranchLength = 30;
    export function toBranchName(user: User, issueTitle: string, issueNr: number): string {
        const titleWords = issueTitle
            .toLowerCase()
            .replace(/[^a-z]/g, "-")
            .split("-")
            .filter((w) => w.length > 0);
        let localBranch = (user.name + "/").toLowerCase();
        for (const segment of titleWords) {
            if (localBranch.length > maxBaseBranchLength) {
                break;
            }
            localBranch += segment + "-";
        }
        localBranch += issueNr;
        return sanitizedRefName(localBranch);
    }
}
