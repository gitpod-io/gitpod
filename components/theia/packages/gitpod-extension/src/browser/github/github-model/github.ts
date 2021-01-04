/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Octokit as GitHub } from '@octokit/rest';

export {
    GitHub
}

export interface GitHubError<T> extends Error {
    name: 'GitHubError';
    result: QueryResult<T>
}
export namespace GitHubError {
    export function create<T>(message: string, query: QueryResult<T>): GitHubError<T> {
        const error = new Error(message) as GitHubError<T>;
        error.result = query;
        throw error;
    }
    export function is<T>(error: Error | undefined): error is GitHubError<T> {
        return !!error && 'result' in error;
    }
    export function getErrors(error: Error | undefined): QueryError[] | undefined {
        if (is(error) && !!error.result.errors) {
            return error.result.errors;
        }
    }
}

export interface QueryResult<D> {
    data?: D;
    errors?: QueryError[];
}

export interface QueryError {
    path: string[];
    message: string;
    locations: QueryLocation;
}

export interface QueryLocation {
    line: number
    column: number
}

export class GitHubApiError extends Error {
    constructor(public status: number, public headers: { [key: string]: string }) {
        super(`GitHub API Error. Status: ${status}`);
        this.name = 'GitHubApiError';
    }
}
export namespace GitHubApiError {
    export function is(error: Error | null): error is GitHubApiError {
        return !!error && error.name === 'GitHubApiError';
    }
}

export interface GitHubResult<T> extends GitHub.Response<T> { }
export namespace GitHubResult {
    export function actualScopes(result: GitHub.Response<any>): string[] {
        return ((result.headers as any)["x-oauth-scopes"] || "").split(",").map((s: any) => s.trim());
    }
    export function mayReadOrgs(result: GitHub.Response<any>): boolean {
        return actualScopes(result).some(scope => scope === "read:org" || scope === "user");
    }
    export function mayWritePrivate(result: GitHub.Response<any>): boolean {
        return actualScopes(result).some(scope => scope === "repo");
    }
    export function mayWritePublic(result: GitHub.Response<any>): boolean {
        return actualScopes(result).some(scope => scope === "repo" || scope === "public_repo");
    }
}

export namespace GitHubUtils {
    /**
     * +----+------------------------------------------+--------------------------------+
     * |    |                Enterprise                |             GitHub             |
     * +----+------------------------------------------+--------------------------------+
     * | v3 | https://[YOUR_HOST]/api/v3               | https://api.github.com         |
     * | v4 | https://[YOUR_HOST]/api/graphql          | https://api.github.com/graphql |
     * +----+------------------------------------------+--------------------------------+
     */
    export function baseURL(host: string) {
        return (host === 'github.com') ? 'https://api.github.com' : `https://${host}/api/v3`;
    }

    /**
     * +----+------------------------------------------+--------------------------------+
     * |    |                Enterprise                |             GitHub             |
     * +----+------------------------------------------+--------------------------------+
     * | v3 | https://[YOUR_HOST]/api/v3               | https://api.github.com         |
     * | v4 | https://[YOUR_HOST]/api/graphql          | https://api.github.com/graphql |
     * +----+------------------------------------------+--------------------------------+
     */
    export function baseURLv4(host: string) {
        return (host === 'github.com') ? 'https://api.github.com/graphql' : `https://${host}/api/graphql`;
    }

    export async function callAPIv4<T>(request: object, host: string, token: string): Promise<QueryResult<T>> {
        const fetchBrowserLike = async (...args: Parameters<typeof fetch>) => {
            const response = await fetch(...args);
            if (response.ok) {
                return response;
            } else {
                const error = new Error(response.statusText);
                (error as any).response = response;
                throw error;
            }
        }

        const response = await fetchBrowserLike(baseURLv4(host), {
            method: 'POST',
            body: JSON.stringify(request),
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });
        const result: QueryResult<T> = await response.json();
        if (!result.data || result.errors) {
            throw GitHubError.create<T>(JSON.stringify({
                request,
                result
            }, undefined, 2), result);
        }
        return result;
    }

    export function createAPIv3(host: string, token: string, previews?: string[]) {
        return new GitHub({
            request: {
                timeout: 5000
            },
            baseUrl: baseURL(host),
            auth: token,
            userAgent: window.location.hostname,
            previews,
        });
    }
}

