/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import fetch from 'node-fetch';
import { Octokit, RestEndpointMethodTypes } from "@octokit/rest"
import { OctokitResponse } from "@octokit/types"
import { OctokitOptions } from "@octokit/core/dist-types/types"

import { Branch, CommitInfo, User } from "@gitpod/gitpod-protocol"
import { injectable, inject } from 'inversify';
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { GitHubScope } from './scopes';
import { AuthProviderParams } from '../auth/auth-provider';
import { GitHubTokenHelper } from './github-token-helper';
import { Deferred } from '@gitpod/gitpod-protocol/lib/util/deferred';

import { URL } from 'url';

export class GitHubApiError extends Error {
    constructor(public readonly response: OctokitResponse<any>) {
        super(`GitHub API Error. Status: ${response.status}`);
        this.name = 'GitHubApiError';
    }
}
export namespace GitHubApiError {
    export function is(error: Error | null): error is GitHubApiError {
        return !!error && error.name === 'GitHubApiError';
    }
}

@injectable()
export class GitHubGraphQlEndpoint {

    @inject(AuthProviderParams) readonly config: AuthProviderParams;
    @inject(GitHubTokenHelper) protected readonly tokenHelper: GitHubTokenHelper;

    public async getFileContents(user: User, org: string, name: string, commitish: string, path: string): Promise<string | undefined> {
        const githubToken = await this.tokenHelper.getTokenWithScopes(user, [/* TODO: check if private_repo has to be required */]);
        const token = githubToken.value;
        const { host } = this.config;
        const urlString = host === 'github.com' ?
            `https://raw.githubusercontent.com/${org}/${name}/${commitish}/${path}` :
            `https://${host}/${org}/${name}/raw/${commitish}/${path}`;
        const response = await fetch(urlString, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            return undefined;
        }
        return response.text();
    }

    /**
     * +----+------------------------------------------+--------------------------------+
     * |    |                Enterprise                |             GitHub             |
     * +----+------------------------------------------+--------------------------------+
     * | v3 | https://[YOUR_HOST]/api/v3               | https://api.github.com         |
     * | v4 | https://[YOUR_HOST]/api/graphql          | https://api.github.com/graphql |
     * +----+------------------------------------------+--------------------------------+
     */
    get baseURLv4() {
        return (this.config.host === 'github.com') ? 'https://api.github.com/graphql' : `https://${this.config.host}/api/graphql`;
    }

    public async runQuery<T>(user: User, query: string, variables?: object): Promise<QueryResult<T>> {
        const githubToken = await this.tokenHelper.getTokenWithScopes(user, [/* TODO: check if private_repo has to be required */]);
        const token = githubToken.value;
        const request = {
            query: query.trim(),
            variables
        };
        return this.runQueryWithToken(token, request);
    }

    async runQueryWithToken<T>(token: string, request: object): Promise<QueryResult<T>> {
        const response = await fetch(this.baseURLv4, {
            method: 'POST',
            body: JSON.stringify(request),
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            throw Error(response.statusText);
        }
        const result: QueryResult<T> = await response.json();
        if (!result.data && result.errors) {
            const error = new Error(JSON.stringify({
                request,
                result
            }));
            (error as any).result = result;
            throw error;
        }
        return result;

    }
}

export interface QueryResult<D> {
    data: D
    errors?: QueryError[];
}

export interface QueryError {
    message: string
    locations: QueryLocation
}

export interface QueryLocation {
    line: number
    column: number
}

@injectable()
export class GitHubRestApi {

    @inject(AuthProviderParams) readonly config: AuthProviderParams;
    @inject(GitHubTokenHelper) protected readonly tokenHelper: GitHubTokenHelper;
    protected async create(userOrToken: User | string) {
        let token: string | undefined;
        if (typeof userOrToken === 'string') {
            token = userOrToken;
        } else {
            const githubToken = await this.tokenHelper.getTokenWithScopes(userOrToken, GitHubScope.Requirements.DEFAULT);
            token = githubToken.value;
        }
        const api = new Octokit(this.getGitHubOptions(token));
        return api;
    }

    protected get userAgent() {
        return new URL(this.config.oauth!.callBackUrl).hostname;
    }

    /**
     * +----+------------------------------------------+--------------------------------+
     * |    |                Enterprise                |             GitHub             |
     * +----+------------------------------------------+--------------------------------+
     * | v3 | https://[YOUR_HOST]/api/v3               | https://api.github.com         |
     * | v4 | https://[YOUR_HOST]/api/graphql          | https://api.github.com/graphql |
     * +----+------------------------------------------+--------------------------------+
     */
    get baseURL() {
        return (this.config.host === 'github.com') ? 'https://api.github.com' : `https://${this.config.host}/api/v3`;
    }

    protected getGitHubOptions(auth: string): OctokitOptions {
        return {
            auth,
            request: {
                timeout: 5000
            },
            baseUrl: this.baseURL,
            userAgent: this.userAgent
        };
    }

    public async run<R>(userOrToken: User | string, operation: (api: Octokit) => Promise<OctokitResponse<R>>): Promise<OctokitResponse<R>> {
        const before = new Date().getTime();
        const userApi = await this.create(userOrToken);

        try {
            const response = (await operation(userApi));
            const statusCode = response.status;
            if (statusCode !== 200) {
                throw new GitHubApiError(response);
            }
            return response;
        } catch (error) {
            if (error.status) {
                throw new GitHubApiError(error);
            }
            throw error;
        } finally {
            log.debug(`GitHub request took ${new Date().getTime() - before} ms`);
        }
    }

    protected readonly cachedResponses = new Map<string, OctokitResponse<any>>();
    public async runWithCache(key: string, user: User, operation: (api: Octokit) => Promise<OctokitResponse<any>>): Promise<OctokitResponse<any>> {
        const result = new Deferred<OctokitResponse<any>>();
        const before = new Date().getTime();
        const cacheKey = `${this.config.host}-${key}`;
        const cachedResponse = this.cachedResponses.get(cacheKey);
        const api = await this.create(user);

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
                    return cachedResponse;
                }
                this.cachedResponses.delete(cacheKey);
                throw error;
            }
        });

        try {
            await operation(api);
        } catch (e) {
            result.reject(e);
        } finally {
            log.debug(`GitHub request took ${new Date().getTime() - before} ms`);
        }
        return result.promise;
    }

    public async getRepository(user: User, params: RestEndpointMethodTypes["repos"]["get"]["parameters"]): Promise<Repository> {
        const key = `getRepository:${params.owner}/${params.repo}:${user.id}`;
        const response = await this.runWithCache(key, user, (api) => api.repos.get(params));
        return response.data;
    }

    public async createRepositoryFromTemplate(user: User, params: RestEndpointMethodTypes["repos"]["createUsingTemplate"]["parameters"]): Promise<Repository> {
        const key = `createRepositoryFromTemplate:${params.template_owner}/${params.template_repo}:${params.owner}/${params.name}:${user.id}`;
        const response = await this.runWithCache(key, user, (api) => api.repos.createUsingTemplate(params));
        return response.data;
    }

    public async getBranch(user: User, params: RestEndpointMethodTypes["repos"]["getBranch"]["parameters"]): Promise<Branch> {
        const key = `getBranch:${params.owner}/${params.owner}/${params.branch}:${user.id}`;
        const getBranchResponse = (await this.runWithCache(key, user, (api) => api.repos.getBranch(params))) as RestEndpointMethodTypes["repos"]["getBranch"]["response"];
        const { commit: { sha }, name, _links: { html } } = getBranchResponse.data;

        const commit = await this.getCommit(user, { ...params, ref: sha });

        return {
            name,
            commit,
            htmlUrl: html
        };
    }

    public async getBranches(user: User, params: RestEndpointMethodTypes["repos"]["listBranches"]["parameters"]): Promise<Branch[]> {
        const key = `getBranches:${params.owner}/${params.owner}:${user.id}`;
        const listBranchesResponse = (await this.runWithCache(key, user, (api) => api.repos.listBranches(params))) as RestEndpointMethodTypes["repos"]["listBranches"]["response"];

        const result: Branch[] = [];

        for (const branch of listBranchesResponse.data) {
            const { commit: { sha } } = branch;
            const commit = await this.getCommit(user, { ...params, ref: sha });

            const key = `getBranch:${params.owner}/${params.owner}/${params.branch}:${user.id}`;
            const getBranchResponse = (await this.runWithCache(key, user, (api) => api.repos.listBranches(params))) as RestEndpointMethodTypes["repos"]["getBranch"]["response"];
            const htmlUrl = getBranchResponse.data._links.html;

            result.push({
                name: branch.name,
                commit,
                htmlUrl
            });
        }

        return result;
    }

    public async getCommit(user: User, params: RestEndpointMethodTypes["repos"]["getCommit"]["parameters"]): Promise<CommitInfo> {
        const key = `getCommit:${params.owner}/${params.owner}/${params.ref}:${user.id}`;
        const getCommitResponse = (await this.runWithCache(key, user, (api) => api.repos.getCommit(params))) as RestEndpointMethodTypes["repos"]["getCommit"]["response"];
        const { sha, commit, author } = getCommitResponse.data;
        return {
            sha,
            author: commit.author?.name || "nobody",
            authorAvatarUrl: author?.avatar_url,
            authorDate: commit.author?.date,
            commitMessage: commit.message,
        }
    }

}

export interface GitHubResult<T> extends OctokitResponse<T> { }
export namespace GitHubResult {
    export function actualScopes(result: OctokitResponse<any>): string[] {
        return (result.headers['x-oauth-scopes'] || "").split(",").map((s: any) => s.trim());
    }
    export function mayReadOrgs(result: OctokitResponse<any>): boolean {
        return actualScopes(result).some(scope => scope === "read:org" || scope === "user");
    }
    export function mayWritePrivate(result: OctokitResponse<any>): boolean {
        return actualScopes(result).some(scope => scope === "repo");
    }
    export function mayWritePublic(result: OctokitResponse<any>): boolean {
        return actualScopes(result).some(scope => scope === "repo" || scope === "public_repo");
    }
}

// Git
export interface CommitUser {
    date: string
    name: string
    email: string
}

export interface CommitVerification {
    verified: boolean   // ???
    reason: "unsigned"  // ???
    signature: null     // ???
    payload: null       // ???
}

export interface Commit extends CommitRef {
    author: CommitUser
    committer: CommitUser
    message: string
    tree: TreeRef
    parents: TreeRef[]
    verification: CommitVerification
}

export interface CommitRef {
    sha: string
    url: string
}

export interface Tree extends TreeRef {
    tree: TreeNode[]
    truncated: boolean
}

export interface TreeRef {
    sha: string
    url: string
}

export interface TreeNode {
    path: string
    mode: number    //"100644",
    type: string    //"blob",
    sha: string     //"5f2f16bfff90e6620509c0cf442e7a3586dad8fb",
    size: number    // 5 ???
    url: string     //"https://api.github.com/repos/somefox/test/git/blobs/5f2f16bfff90e6620509c0cf442e7a3586dad8fb"
}

export interface BlobTreeNode extends TreeNode {
    type: "blob"
}

export interface Blob {
    content: string,        // always base64 encoded! (https://developer.github.com/v3/git/blobs/#get-a-blob)
    encoding: "base64",
    url: string,
    sha: string,
    size: number            // bytes?
}

export interface BranchRef {
    name: string
    commit: CommitRef
    protected: boolean
    protection_url?: string
}

export interface CommitDetails {
    url: string
    sha: string
    node_id: string
    html_url: string
    comments_url: string
    commit: Commit
    author: UserRef
    committer: UserRef
    parents: CommitRef[]
}
export type CommitResponse = CommitDetails[];

// GitHub
export type UserEmails = UserEmail[];
export interface UserEmail {
    email: string
    verified: boolean
    primary: boolean
    visibility: "public" | "private"
}

export interface UserRef {
    login: string
    id: number
    avatar_url: string
    gravatar_id: string
    url: string
    html_url: string
    followers_url: string
    following_url: string
    gists_url: string
    starred_url: string
    subscriptions_url: string
    organizations_url: string
    repos_url: string
    events_url: string
    received_events_url: string
    type: "User" | "Organization"
    site_admin: boolean
}


export interface License {
    key: "mit"
    name: string
    spdx_id: string
    url: string
    html_url: string
}

export interface Repository {
    id: number
    owner: UserRef
    name: string
    full_name: string
    description: string
    private: boolean
    fork: boolean
    url: string
    html_url: string
    archive_url: string
    assignees_url: string
    blobs_url: string
    branches_url: string
    clone_url: string
    collaborators_url: string
    comments_url: string
    commits_url: string
    compare_url: string
    contents_url: string
    contributors_url: string
    deployments_url: string
    downloads_url: string
    events_url: string
    forks_url: string
    git_commits_url: string
    git_refs_url: string
    git_tags_url: string
    git_url: string
    hooks_url: string
    issue_comment_url: string
    issue_events_url: string
    issues_url: string
    keys_url: string
    labels_url: string
    languages_url: string
    merges_url: string
    milestones_url: string
    mirror_url: string
    notifications_url: string
    pulls_url: string
    releases_url: string
    ssh_url: string
    stargazers_url: string
    statuses_url: string
    subscribers_url: string
    subscription_url: string
    svn_url: string
    tags_url: string
    teams_url: string
    trees_url: string
    homepage: string
    language: null
    forks_count: number
    stargazers_count: number
    watchers_count: number
    size: number
    default_branch: string
    open_issues_count: number
    topics: string[]
    has_issues: boolean
    has_wiki: boolean
    has_pages: boolean
    has_downloads: boolean
    archived: boolean
    pushed_at: string
    created_at: string
    updated_at: string
    permissions?: {     // No permissions means "no permissions"
        admin: boolean
        push: boolean
        pull: boolean
    },
    allow_rebase_merge: boolean
    allow_squash_merge: boolean
    allow_merge_commit: boolean
    subscribers_count: number
    network_count: number
    license: License
    organization: UserRef
    parent: Repository
    source: Repository
}

export interface CommitRefInUserRepo {
    label: string
    ref: string
    sha: string
    user: UserRef
    repo: Repository
}

export interface PullRequest {
    id: number
    url: string
    html_url: string
    diff_url: string
    patch_url: string
    issue_url: string
    commits_url: string
    review_comments_url: string
    review_comment_url: string
    comments_url: string
    statuses_url: string
    number: number
    state: "open"
    title: string
    body: string
    assignee: UserRef
    labels: Label[]
    milestone: Milestone
    locked: boolean
    active_lock_reason?: "too heated" | "off-topic" | "resolved" | "spam"   // The reason for locking the issue or pull request conversation. Lock will fail if you don't use one of these reasons: ...
    created_at: string
    updated_at: string
    closed_at: string
    merged_at: string
    head: CommitRefInUserRepo
    base: CommitRefInUserRepo
    "_links": {
        self: Link
        html: Link
        issue: Link
        comments: Link
        review_comments: Link
        review_comment: Link
        commits: Link
        statuses: Link
    }
    user: UserRef
    merge_commit_sha: string
    merged: boolean
    mergeable: boolean
    merged_by: UserRef
    comments: number
    commits: number
    additions: number
    deletions: number
    changed_files: number
    maintainer_can_modify: boolean
}

export interface Link { href: string }

export interface Label {
    id: number
    url: string
    name: string
    description: string
    color: string   // f29513
    default: boolean
}

export interface Milestone {
    // ??? Not relevant yet
}

export interface Issue {
    id: number
    url: string
    number: number
    title: string
    user: UserRef
    labels: Label[]
    state: "open" | "closed"
    html_url: string
    pull_request?: {
        url: string
        html_url: string
        diff_url: string
        patch_url: string
    }
    repository_url: string
    labels_url: string
    comments_url: string
    events_url: string
    body: string
    assignee: null | UserRef
    assignees: UserRef[]
    milestone: null | Milestone
    locked: boolean
    active_lock_reason?: "too heated" | "off-topic" | "resolved" | "spam"   // The reason for locking the issue or pull request conversation. Lock will fail if you don't use one of these reasons: ...
    created_at: string
    updated_at: string
    closed_at: null | string
    closed_by: null | UserRef
}


export namespace Issue {
    export function isPullRequest(issue: Issue): boolean {
        return 'pull_request' in issue;
    }
}

// Contents
export type ContentType = 'file' | 'dir' | 'symlink' | 'submodule';
export interface ContentMetadata {
    type: ContentType
    size: number
    name: string
    path: string
    sha: string
    url: string
    git_url: string
    html_url: string
    download_url: string | null
    _links: {
        self: string
        git: string
        html: string
    }
}
export namespace ContentMetadata {
    export function is(content: any): content is ContentMetadata {
        return 'type' in content
            && 'size' in content
            && 'name' in content
            && 'path' in content
            && 'sha' in content;
    }
}

export interface FileMetadata extends ContentMetadata {
    type: 'file'
}
export namespace FileMetadata {
    export function is(content: any): content is FileMetadata {
        return ContentMetadata.is(content)
            && content.type === 'file';
    }
}

export interface DirectoyMetadata extends ContentMetadata {
    type: 'dir'
}
export namespace DirectoyMetadata {
    export function is(content: any): content is DirectoyMetadata {
        return ContentMetadata.is(content)
            && content.type === 'dir';
    }
}

export interface SymlinkMetadata extends ContentMetadata {
    type: 'symlink'
}
export namespace SymlinkMetadata {
    export function is(content: any): content is SymlinkMetadata {
        return ContentMetadata.is(content)
            && content.type === 'symlink';
    }
}

export interface SubmoduleMetadata extends ContentMetadata {
    type: 'submodule'
}
export namespace SubmoduleMetadata {
    export function is(content: any): content is SubmoduleMetadata {
        return ContentMetadata.is(content)
            && content.type === 'submodule';
    }
}

export interface FileContent extends FileMetadata {
    encoding: 'base64'
    content: string
}
export namespace FileContent {
    export function is(content: any): content is FileContent {
        return FileMetadata.is(content)
            && 'encoding' in content
            && 'content' in content;
    }
}

export type DirectoryContent = ContentMetadata[];
export namespace DirectoryContent {
    export function is(content: any): content is DirectoryContent {
        return Array.isArray(content);
    }
}

export interface SymlinkContent extends SymlinkMetadata {
    target: string
}
export namespace SymlinkContent {
    export function is(content: any): content is SymlinkContent {
        return SymlinkMetadata.is(content)
            && 'target' in content;
    }
}

export interface SubmoduleContent extends SubmoduleMetadata {
    submodule_git_url: string
}
export namespace SubmoduleContent {
    export function is(content: any): content is SubmoduleContent {
        return SubmoduleMetadata.is(content)
            && 'submodule_git_url' in content;
    }
}

export type Content = ContentMetadata;
export type Contents = ContentMetadata | DirectoryContent;
