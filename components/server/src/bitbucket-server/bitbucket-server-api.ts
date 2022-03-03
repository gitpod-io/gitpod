/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import fetch from 'node-fetch';
import { User } from '@gitpod/gitpod-protocol';
import { inject, injectable } from 'inversify';
import { AuthProviderParams } from '../auth/auth-provider';
import { BitbucketServerTokenHelper } from './bitbucket-server-token-handler';

@injectable()
export class BitbucketServerApi {
    @inject(AuthProviderParams) protected readonly config: AuthProviderParams;
    @inject(BitbucketServerTokenHelper) protected readonly tokenHelper: BitbucketServerTokenHelper;

    public async runQuery<T>(user: User, urlPath: string): Promise<T> {
        const token = (await this.tokenHelper.getTokenWithScopes(user, [])).value;
        const fullUrl = `${this.baseUrl}${urlPath}`;
        const response = await fetch(fullUrl, {
            timeout: 10000,
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
        });
        if (!response.ok) {
            throw Error(response.statusText);
        }
        const result = await response.json();
        return result as T;
    }

    protected get baseUrl(): string {
        return `https://${this.config.host}/rest/api/1.0`;
    }

    getRepository(
        user: User,
        params: { kind: 'projects' | 'users'; userOrProject: string; repositorySlug: string },
    ): Promise<BitbucketServer.Repository> {
        return this.runQuery<BitbucketServer.Repository>(
            user,
            `/${params.kind}/${params.userOrProject}/repos/${params.repositorySlug}`,
        );
    }

    getCommits(
        user: User,
        params: { kind: 'projects' | 'users'; userOrProject: string; repositorySlug: string; q?: { limit: number } },
    ): Promise<BitbucketServer.Paginated<BitbucketServer.Commit>> {
        return this.runQuery<BitbucketServer.Paginated<BitbucketServer.Commit>>(
            user,
            `/${params.kind}/${params.userOrProject}/repos/${params.repositorySlug}/commits`,
        );
    }

    getDefaultBranch(
        user: User,
        params: { kind: 'projects' | 'users'; userOrProject: string; repositorySlug: string },
    ): Promise<BitbucketServer.Branch> {
        //https://bitbucket.gitpod-self-hosted.com/rest/api/1.0/users/jldec/repos/test-repo/default-branch
        return this.runQuery<BitbucketServer.Branch>(
            user,
            `/${params.kind}/${params.userOrProject}/repos/${params.repositorySlug}/default-branch`,
        );
    }
}

export namespace BitbucketServer {
    export interface Repository {
        id: number;
        slug: string;
        name: string;
        public: boolean;
        links: {
            clone: {
                href: string;
                name: string;
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
    }

    export interface Branch {
        id: string;
        displayId: string;
        type: 'BRANCH' | string;
        latestCommit: string;
        isDefault: boolean;
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
    }

    export interface Commit {
        id: string;
        displayId: string;
        author: BitbucketServer.User;
    }

    export interface Paginated<T> {
        isLastPage?: boolean;
        limit?: number;
        size?: number;
        start?: number;
        values?: T[];
        [k: string]: any;
    }
}
