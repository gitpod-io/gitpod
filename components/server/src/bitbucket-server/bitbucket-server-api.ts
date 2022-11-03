/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import fetch from "node-fetch";
import { User } from "@gitpod/gitpod-protocol";
import { inject, injectable } from "inversify";
import { AuthProviderParams } from "../auth/auth-provider";
import { BitbucketServerTokenHelper } from "./bitbucket-server-token-handler";

@injectable()
export class BitbucketServerApi {
    @inject(AuthProviderParams) protected readonly config: AuthProviderParams;
    @inject(BitbucketServerTokenHelper) protected readonly tokenHelper: BitbucketServerTokenHelper;

    public async runQuery<T>(
        userOrToken: User | string,
        urlPath: string,
        method: string = "GET",
        body?: string,
    ): Promise<T> {
        const token =
            typeof userOrToken === "string"
                ? userOrToken
                : (await this.tokenHelper.getTokenWithScopes(userOrToken, [])).value;
        const fullUrl = `${this.baseUrl}${urlPath}`;
        let result: string = "OK";
        try {
            const response = await fetch(fullUrl, {
                timeout: 10000,
                method,
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body,
            });

            if (!response.ok) {
                let json: object | undefined;
                try {
                    json = await response.json();
                } catch {
                    // ignoring non-json responses and handling in general case bellow
                }
                if (BitbucketServer.ErrorResponse.is(json)) {
                    throw Object.assign(new Error(`${response.status} / ${json.errors[0]?.message}`), {
                        json,
                    });
                }
                throw Object.assign(new Error(`${response.status} / ${response.statusText}`), { response });
            }
            return (await response.json()) as T;
        } catch (error) {
            result = "error " + error?.message;
            throw error;
        } finally {
            console.log(`BBS: ${method} ${fullUrl} - ${result}`);
        }
    }

    public async fetchContent(user: User, urlPath: string): Promise<string> {
        const token = (await this.tokenHelper.getTokenWithScopes(user, [])).value;
        const fullUrl = `${this.baseUrl}${urlPath}`;
        let result: string = "OK";
        try {
            const response = await fetch(fullUrl, {
                timeout: 10000,
                method: "GET",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                throw Error(`${response.status} / ${response.statusText}`);
            }
            return await response.text();
        } catch (error) {
            result = "error " + error?.message;
            throw error;
        } finally {
            console.debug(`BBS GET ${fullUrl} - ${result}`);
        }
    }

    public async currentUsername(accessToken: string): Promise<string> {
        const fullUrl = `https://${this.config.host}/plugins/servlet/applinks/whoami`;
        let result: string = "OK";
        try {
            const response = await fetch(fullUrl, {
                timeout: 10000,
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });
            if (!response.ok) {
                throw new Error(`${response.status} / ${response.statusText}`);
            }
            return response.text();
        } catch (error) {
            result = error?.message;
            console.error(`BBS GET ${fullUrl} - ${result}`);
            throw error;
        }
    }

    getAvatarUrl(username: string) {
        return `https://${this.config.host}/users/${username}/avatar.png`;
    }

    async getUserProfile(userOrToken: User | string, username: string): Promise<BitbucketServer.User> {
        return this.runQuery<BitbucketServer.User>(userOrToken, `/users/${username}`);
    }

    async getProject(userOrToken: User | string, projectSlug: string): Promise<BitbucketServer.Project> {
        return this.runQuery<BitbucketServer.Project>(userOrToken, `/projects/${projectSlug}`);
    }

    async getPermission(
        userOrToken: User | string,
        params: { username: string; repoKind: BitbucketServer.RepoKind; owner: string; repoName?: string },
    ): Promise<string | undefined> {
        const { username, repoKind, owner, repoName } = params;
        if (repoName) {
            const repoPermissions = await this.runQuery<BitbucketServer.Paginated<BitbucketServer.PermissionEntry>>(
                userOrToken,
                `/${repoKind}/${owner}/repos/${repoName}/permissions/users`,
            );
            const repoPermission = repoPermissions.values?.find((p) => p.user.name === username)?.permission;
            if (repoPermission) {
                return repoPermission;
            }
        }
        if (repoKind === "projects") {
            const projectPermissions = await this.runQuery<BitbucketServer.Paginated<BitbucketServer.PermissionEntry>>(
                userOrToken,
                `/${repoKind}/${owner}/permissions/users`,
            );
            const projectPermission = projectPermissions.values?.find((p) => p.user.name === username)?.permission;
            return projectPermission;
        }
    }

    protected get baseUrl(): string {
        return `https://${this.config.host}/rest/api/1.0`;
    }

    async getRepository(
        userOrToken: User | string,
        params: { repoKind: "projects" | "users"; owner: string; repositorySlug: string },
    ): Promise<BitbucketServer.Repository> {
        return this.runQuery<BitbucketServer.Repository>(
            userOrToken,
            `/${params.repoKind}/${params.owner}/repos/${params.repositorySlug}`,
        );
    }

    async getCommits(
        user: User,
        params: {
            repoKind: "projects" | "users" | string;
            owner: string;
            repositorySlug: string;
            query?: { limit?: number; path?: string; shaOrRevision?: string };
        },
    ): Promise<BitbucketServer.Paginated<BitbucketServer.Commit>> {
        let q = "";
        if (params.query) {
            const segments = [];
            if (params.query.limit) {
                segments.push(`limit=${params.query.limit}`);
            }
            if (params.query.path) {
                segments.push(`path=${params.query.path}`);
            }
            if (params.query.shaOrRevision) {
                segments.push(`until=${params.query.shaOrRevision}`);
            }
            if (segments.length > 0) {
                q = `?${segments.join("&")}`;
            }
        }
        return this.runQuery<BitbucketServer.Paginated<BitbucketServer.Commit>>(
            user,
            `/${params.repoKind}/${params.owner}/repos/${params.repositorySlug}/commits${q}`,
        );
    }

    async getDefaultBranch(
        user: User,
        params: { repoKind: "projects" | "users"; owner: string; repositorySlug: string },
    ): Promise<BitbucketServer.Branch> {
        return this.runQuery<BitbucketServer.Branch>(
            user,
            `/${params.repoKind}/${params.owner}/repos/${params.repositorySlug}/default-branch`,
        );
    }

    getHtmlUrlForBranch(params: {
        repoKind: "projects" | "users";
        owner: string;
        repositorySlug: string;
        branchName: string;
    }): string {
        return `https://${this.config.host}/${params.repoKind}/${params.owner}/repos/${
            params.repositorySlug
        }/browse?at=${encodeURIComponent(`refs/heads/${params.branchName}`)}`;
    }

    async getBranch(
        user: User,
        params: { repoKind: "projects" | "users"; owner: string; repositorySlug: string; branchName: string },
    ): Promise<BitbucketServer.BranchWithMeta> {
        const result = await this.runQuery<BitbucketServer.Paginated<BitbucketServer.BranchWithMeta>>(
            user,
            `/${params.repoKind}/${params.owner}/repos/${params.repositorySlug}/branches?details=true&filterText=${params.branchName}&boostMatches=true`,
        );
        const first = result.values && result.values[0];
        if (first && first.displayId === params.branchName) {
            first.latestCommitMetadata =
                first.metadata["com.atlassian.bitbucket.server.bitbucket-branch:latest-commit-metadata"];
            first.htmlUrl = this.getHtmlUrlForBranch({
                repoKind: params.repoKind,
                owner: params.owner,
                repositorySlug: params.repositorySlug,
                branchName: first.displayId,
            });
            return first;
        }
        throw new Error(`Could not find branch "${params.branchName}."`);
    }

    async getBranches(
        user: User,
        params: { repoKind: "projects" | "users"; owner: string; repositorySlug: string },
    ): Promise<BitbucketServer.BranchWithMeta[]> {
        const result = await this.runQuery<BitbucketServer.Paginated<BitbucketServer.BranchWithMeta>>(
            user,
            `/${params.repoKind}/${params.owner}/repos/${params.repositorySlug}/branches?details=true&orderBy=MODIFICATION&limit=1000`,
        );
        const branches = result.values || [];
        for (const branch of branches) {
            branch.latestCommitMetadata =
                branch.metadata["com.atlassian.bitbucket.server.bitbucket-branch:latest-commit-metadata"];
            branch.htmlUrl = this.getHtmlUrlForBranch({
                repoKind: params.repoKind,
                owner: params.owner,
                repositorySlug: params.repositorySlug,
                branchName: branch.displayId,
            });
        }
        return branches;
    }

    async getWebhooks(
        user: User,
        params: { repoKind: "projects" | "users"; owner: string; repositorySlug: string },
    ): Promise<BitbucketServer.Paginated<BitbucketServer.Webhook>> {
        return this.runQuery<BitbucketServer.Paginated<BitbucketServer.Webhook>>(
            user,
            `/${params.repoKind}/${params.owner}/repos/${params.repositorySlug}/webhooks`,
        );
    }

    async setWebhook(
        user: User,
        params: { repoKind: "projects" | "users"; owner: string; repositorySlug: string },
        webhook: BitbucketServer.WebhookParams,
    ) {
        const body = JSON.stringify(webhook);
        return this.runQuery<any>(
            user,
            `/${params.repoKind}/${params.owner}/repos/${params.repositorySlug}/webhooks`,
            "POST",
            body,
        );
    }

    async getRepos(
        user: User,
        query: {
            permission?: "REPO_READ" | "REPO_WRITE" | "REPO_ADMIN";
            limit: number;
        },
    ) {
        let q = "";
        if (query) {
            const segments = [];
            if (query.permission) {
                segments.push(`permission=${query.permission}`);
            }
            if (query.limit) {
                segments.push(`limit=${query.limit}`);
            }
            if (segments.length > 0) {
                q = `?${segments.join("&")}`;
            }
        }
        return this.runQuery<BitbucketServer.Paginated<BitbucketServer.Repository>>(user, `/repos${q}`);
    }

    async getPullRequest(
        user: User,
        params: { repoKind: "projects" | "users"; owner: string; repositorySlug: string; nr: number },
    ): Promise<BitbucketServer.PullRequest> {
        const result = await this.runQuery<BitbucketServer.PullRequest>(
            user,
            `/${params.repoKind}/${params.owner}/repos/${params.repositorySlug}/pull-requests/${params.nr}`,
        );
        return result;
    }
}

export namespace BitbucketServer {
    export type RepoKind = "users" | "projects";
    export interface Repository {
        id: number;
        slug: string;
        name: string;
        description?: string;
        public: boolean;
        links: {
            clone: {
                href: string;
                name: string;
            }[];
            self: {
                href: string;
            }[];
        };
        project: Project;
    }

    export interface Project {
        key: string;
        owner?: User;
        id: number;
        name: string;
        public: boolean;
        type: "PERSONAL" | "NORMAL";
    }

    export interface Branch {
        id: string;
        displayId: string;
        type: "BRANCH" | string;
        latestCommit: string;
        isDefault: boolean;
    }

    export interface BranchWithMeta extends Branch {
        latestCommitMetadata: Commit;
        htmlUrl: string;
        metadata: {
            "com.atlassian.bitbucket.server.bitbucket-branch:latest-commit-metadata": Commit;
        };
    }

    export interface User {
        name: string;
        emailAddress: string;
        id: number;
        displayName: string;
        active: boolean;
        slug: string;
        type: string;
        links: {
            self: [
                {
                    href: string;
                },
            ];
        };
        avatarUrl?: string;
    }

    export interface Commit {
        id: string;
        displayId: string;
        author: BitbucketServer.User;
        authorTimestamp: number;
        commiter: BitbucketServer.User;
        committerTimestamp: number;
        message: string;
    }

    export interface PullRequest {
        id: number;
        version: number;
        title: string;
        description: string;
        state: "OPEN" | string;
        open: boolean;
        closed: boolean;
        createdDate: number;
        updatedDate: number;
        fromRef: Ref;
        toRef: Ref;
        locked: boolean;
        author: {
            user: User;
            role: "AUTHOR" | string;
            approved: boolean;
            status: "UNAPPROVED" | string;
        };
        // reviewers: [];
        // participants: [];
        links: {
            self: [
                {
                    //"https://bitbucket.gitpod-self-hosted.com/projects/FOO/repos/repo123/pull-requests/1"
                    href: string;
                },
            ];
        };
    }

    export interface Ref {
        id: string; // "refs/heads/foo"
        displayId: string; //"foo"
        latestCommit: string;
        type: "BRANCH" | string;
        repository: Repository;
    }

    export interface Paginated<T> {
        isLastPage?: boolean;
        limit?: number;
        size?: number;
        start?: number;
        values?: T[];
        [k: string]: any;
    }

    export interface Webhook {
        id: number;
        name: "test-webhook";
        createdDate: number;
        updatedDate: number;
        events: any;
        configuration: any;
        url: string;
        active: boolean;
    }

    export interface PermissionEntry {
        user: User;
        permission: string;
    }

    export interface WebhookParams {
        name: string;
        events: string[];
        // "events": [
        //     "repo:refs_changed",
        //     "repo:modified"
        // ],
        configuration: {
            secret: string;
        };
        url: string;
        active: boolean;
    }

    export interface ErrorResponse {
        errors: {
            message: string;
        }[];
    }
    export namespace ErrorResponse {
        export function is(o: any): o is ErrorResponse {
            return typeof o === "object" && "errors" in o;
        }
    }
}
