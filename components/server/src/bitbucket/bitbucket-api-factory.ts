/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { User } from "@gitpod/gitpod-protocol";
import { APIClient, Bitbucket } from "bitbucket";
import { Options } from "bitbucket/lib/bitbucket";
import { inject, injectable } from "inversify";
import { AuthProviderParams } from "../auth/auth-provider";
import { BitbucketTokenHelper } from "./bitbucket-token-handler";

@injectable()
export default class BitbucketApiFactory {

    @inject(AuthProviderParams) protected readonly config: AuthProviderParams;
    @inject(BitbucketTokenHelper) protected readonly tokenHelper: BitbucketTokenHelper;

    /**
     * Returns a Bitbucket API client for the given user.
     * @param user The user the API client should be created for.
     */
    public async create(user: User): Promise<APIClient> {
        const token = await this.tokenHelper.getTokenWithScopes(user, []);
        let options: Options;
        if ("username" in token as any) {
            // For unit tests we use an app password instead of an OAuth token
            // since OAuth tokens are valid for some hours only. For unit tests
            // the username is provided as well.
            options = {
                auth: {
                    username: (token as any).username,
                    password: token.value
                }
            };
        } else {
            options = { auth: { token: token.value } };
        }
        options.baseUrl = `https://api.${this.config.host}/2.0`;
        return new Bitbucket(options);
    }
}