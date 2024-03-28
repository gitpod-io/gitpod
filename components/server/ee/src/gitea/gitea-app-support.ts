/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { AuthProviderInfo, ProviderRepository, User } from "@gitpod/gitpod-protocol";
import { inject, injectable } from "inversify";
import { TokenProvider } from "../../../src/user/token-provider";
import { UserDB } from "@gitpod/gitpod-db/lib";
import { Gitea } from "../../../src/gitea/api";

@injectable()
export class GiteaAppSupport {

    @inject(UserDB) protected readonly userDB: UserDB;
    @inject(TokenProvider) protected readonly tokenProvider: TokenProvider;

    async getProviderRepositoriesForUser(params: { user: User, provider: AuthProviderInfo }): Promise<ProviderRepository[]> {
        const token = await this.tokenProvider.getTokenForHost(params.user, params.provider.host);
        const oauthToken = token.value;
        const api = Gitea.create(`https://${params.provider.host}`, oauthToken);

        const result: ProviderRepository[] = [];
        const ownersRepos: ProviderRepository[] = [];

        const identity = params.user.identities.find(i => i.authProviderId === params.provider.authProviderId);
        if (!identity) {
            return result;
        }
        const usersAccount = identity.authName;

        // TODO: check if valid
        const projectsWithAccess = await api.user.userCurrentListRepos({ limit: 100 });
        for (const project of projectsWithAccess.data) {
            const path = project.full_name as string;
            const cloneUrl = project.clone_url as string;
            const updatedAt = project.updated_at as string;
            const accountAvatarUrl = project.owner?.avatar_url as string;
            const account = project.owner?.login as string;

            (account === usersAccount ? ownersRepos : result).push({
                name: project.name as string,
                path,
                account,
                cloneUrl,
                updatedAt,
                accountAvatarUrl,
                // inUse: // todo(at) compute usage via ProjectHooks API
            })
        }

        // put owner's repos first. the frontend will pick first account to continue with
        result.unshift(...ownersRepos);
        return result;
    }

}