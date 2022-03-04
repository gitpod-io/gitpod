/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { User, Token } from "@gitpod/gitpod-protocol";
import { APIClient, Bitbucket } from "bitbucket";
import { inject, injectable } from "inversify";
import { AuthProviderParams } from "../auth/auth-provider";
import { BitbucketTokenHelper } from "./bitbucket-token-handler";

@injectable()
export class BitbucketApiFactory {

    @inject(AuthProviderParams) protected readonly config: AuthProviderParams;
    @inject(BitbucketTokenHelper) protected readonly tokenHelper: BitbucketTokenHelper;

    /**
     * Returns a Bitbucket API client for the given user.
     * @param user The user the API client should be created for.
     */
    public async create(user: User): Promise<APIClient> {
        const token = await this.tokenHelper.getTokenWithScopes(user, []);
        return this.createBitbucket(this.baseUrl, token);
    }

    protected createBitbucket(baseUrl: string, token: Token): APIClient {
        return new Bitbucket({
            notice: false,
            baseUrl,
            auth: {
                token: token.value
            }
        });
    }

    protected get baseUrl(): string {
        return `https://api.${this.config.host}/2.0`;
    }
}

@injectable()
export class BasicAuthBitbucketApiFactory extends BitbucketApiFactory {
    protected createBitbucket(baseUrl: string, token: Token): APIClient {

        return new Bitbucket({
            notice: false,
            baseUrl,
            auth: {
                username: token.username!,
                password: token.value
            }
        });
    }
}
