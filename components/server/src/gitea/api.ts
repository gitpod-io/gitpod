/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Api, Commit as ICommit, Repository as IRepository, ContentsResponse as IContentsResponse, Branch as IBranch, Tag as ITag, PullRequest as IPullRequest, Issue as IIssue, User as IUser } from "gitea-js"
import fetch from 'node-fetch'

import { User } from "@gitpod/gitpod-protocol"
import { injectable, inject } from 'inversify';
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { GiteaScope } from './scopes';
import { AuthProviderParams } from '../auth/auth-provider';
import { GiteaTokenHelper } from './gitea-token-helper';

export namespace Gitea {
    export class ApiError extends Error {
        readonly httpError: { name: string, description: string } | undefined;
        constructor(msg?: string, httpError?: any) {
            super(msg);
            this.httpError = httpError;
            this.name = 'GiteaApiError';
        }
    }
    export namespace ApiError {
        export function is(something: any): something is ApiError {
            return !!something && something.name === 'GiteaApiError';
        }
        export function isNotFound(error: ApiError): boolean {
            return !!error.httpError?.description.startsWith("404");
        }
        export function isInternalServerError(error: ApiError): boolean {
            return !!error.httpError?.description.startsWith("500");
        }
    }

    export function create(host: string, token: string) {
        return new Api({
            customFetch: fetch,
            baseUrl: `https://${host}`,
            baseApiParams: {
            headers: {
                "Authorization": token,
            },
        }});
    }

    export type Commit = ICommit;
    export type Repository = IRepository;
    export type ContentsResponse = IContentsResponse;
    export type Branch = IBranch;
    export type Tag = ITag;
    export type PullRequest = IPullRequest;
    export type Issue = IIssue;
    export type User = IUser;
}

@injectable()
export class GiteaRestApi {

    @inject(AuthProviderParams) readonly config: AuthProviderParams;
    @inject(GiteaTokenHelper) protected readonly tokenHelper: GiteaTokenHelper;
    protected async create(userOrToken: User | string) {
        let oauthToken: string | undefined;
        if (typeof userOrToken === 'string') {
            oauthToken = userOrToken;
        } else {
            const giteaToken = await this.tokenHelper.getTokenWithScopes(userOrToken, GiteaScope.Requirements.DEFAULT);
            oauthToken = giteaToken.value;
        }
        const api = Gitea.create(this.config.host, oauthToken);
        return api;
    }

    public async run<R>(userOrToken: User | string, operation: (g: Api<unknown>) => Promise<any>): Promise<R | Gitea.ApiError> {
        const before = new Date().getTime();
        const userApi = await this.create(userOrToken);
        try {
            const response = (await operation(userApi) as R);
            return response as R;
        } catch (error) {
            if (error && typeof error?.response?.status === "number" && error?.response?.status !== 200) {
                return new Gitea.ApiError(`Gitea responded with code ${error.response.status}`, error);
            }
            if (error && error?.name === "HTTPError") {
                // e.g.
                //     {
                //         "name": "HTTPError",
                //         "timings": { },
                //         "description": "404 Commit Not Found"
                //     }

                return new Gitea.ApiError(`Gitea Request Error: ${error?.description}`, error);
            }
            log.error(`Gitea request error`, error);
            throw error;
        } finally {
            log.info(`Gitea request took ${new Date().getTime() - before} ms`);
        }
    }
}