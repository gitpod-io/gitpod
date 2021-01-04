/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject } from 'inversify';
import { GitHubTokenProvider } from '../github-token-provider';
import { Permissions } from './permissions';
import { IHunk } from "diff";
import { GitHubExtension } from '../github-extension';
import { Deferred } from '@theia/core/lib/common/promise-util';
import { GitHub, GitHubApiError, GitHubUtils } from './github';
import { GitpodGitTokenValidator } from '../../gitpod-git-token-validator';


@injectable()
export class GitHubRestApi {

    @inject(GitHubTokenProvider)
    protected readonly tokenProvider: GitHubTokenProvider;

    @inject(GitpodGitTokenValidator)
    protected readonly tokenValidator: GitpodGitTokenValidator;

    @inject(GitHubExtension)
    protected readonly extension: GitHubExtension;

    async run<T>(query: (api: GitHub) => Promise<GitHub.Response<T>>, permissions?: Permissions): Promise<GitHub.Response<T>> {
        const api = await this.create({ permissions });
        try {
            return await query(api);
        } catch (error) {
            if (error.status) {
                // error.status == 403
                // error.headers['x-oauth-scopes'] == user:email
                throw new GitHubApiError(error.status, error.headers);
            }
            throw error;
        }
    }

    async create(params?: { permissions?: Permissions, previews?: string[] }): Promise<GitHub> {
        if (!this.enabled) {
            throw new Error("Not a GitHub repository!")
        }
        const token = await this.getToken(this.host, params && params.permissions);
        const api = GitHubUtils.createAPIv3(this.host, token, params && params.previews);
        return api;
    }

    protected get host(): string {
        return this.extension.host;
    }
    protected get enabled(): boolean {
        return this.extension.enabled;
    }

    async getToken(host: string, permissions?: Permissions): Promise<string> {
        return await this.tokenProvider.getToken({ host, ...permissions });
    }

    protected readonly cachedResponses = new Map<string, GitHub.AnyResponse>();
    async runWithCache<T>(key: string, operation: (api: GitHub) => Promise<GitHub.Response<T>>): Promise<GitHub.Response<T>> {
        const result = new Deferred<GitHub.AnyResponse>();
        const cacheKey = `${this.host}-${key}`;
        const cachedResponse = this.cachedResponses.get(cacheKey);
        const api = await this.create(undefined);

        // using hooks in Octokits lifecycle for caching results
        // cf. https://github.com/octokit/rest.js/blob/master/docs/src/pages/api/06_hooks.md
        api.hook.wrap("request", async (request, options) => {

            // send etag on each request if there is something cached for the given key
            if (cachedResponse) {
                if (cachedResponse.headers.etag) {
                    options.headers['If-None-Match'] = cachedResponse.headers.etag;
                }
                if (cachedResponse.headers["last-modified"]) {
                    options.headers['If-Modified-Since'] = cachedResponse.headers["last-modified"];
                }
            }

            try {
                const response = await request(options);

                // on successful responses (HTTP 2xx) we fill the cache
                this.cachedResponses.delete(cacheKey);
                if (response.headers.etag || response.headers["last-modified"]) {
                    this.cachedResponses.set(cacheKey, response);
                }
                result.resolve(response);
                return response;
            } catch (error) {

                // resolve with cached resource if GH tells us that it's not modified (HTTP 304)
                if (error.status === 304 && cachedResponse) {
                    result.resolve(cachedResponse);
                    return;
                }
                this.cachedResponses.delete(cacheKey);
                throw error;
            }
        });

        try {
            await operation(api);
        } catch (e) {
            result.reject(e);
        }
        return result.promise;
    }

    async getMyLogin() {
        const me = await this.run(async api => api.users.getAuthenticated());
        return me;
    }

    async getAuthorizedOrganizations() {
        try {
            const permissions = <Permissions>{
                scopes: ["read:org"],
                message: "Forking a GitHub repository requires read-only access to organizations. Please retry after granting permissions."
            };
            const query = async (api: GitHub) => api.orgs.listForAuthenticatedUser({});
            const result = await this.run(query, permissions);
            return result;
        } catch (error) {
            throw error;
        }
    }

    async hasWritePermission(owner: string, repo: string): Promise<boolean> {
        const token = await this.getToken(this.host);
        const result = await this.tokenValidator.checkWriteAccessForGitHubRepo(token, this.host, `${owner}/${repo}`);
        return !!result && !!result.writeAccessToRepo;
    }

}

/**
 * https://developer.github.com/v3/repos/commits/#compare-two-commits
 */
export interface ReposCompareCommitsResult {
    commits: ReposCompareCommitsResult.Commit[]
    files: ReposCompareCommitsResult.File[]

    /** added for internal use */
    commonParentCommit?: string
}
export namespace ReposCompareCommitsResult {
    export interface File {
        filename: string
        previous_filename?: string
        patch?: string
        hunks?: IHunk[]
    }
    export interface Commit {
        sha: string
        commit: {
            message: string
        }
    }
}
