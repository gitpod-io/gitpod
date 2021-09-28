/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { ProviderRepository, User } from "@gitpod/gitpod-protocol";
import { inject, injectable } from "inversify";
import { TokenProvider } from "../../../src/user/token-provider";
import { UserDB } from "@gitpod/gitpod-db/lib";
import { Gitlab } from "@gitbeaker/node";

@injectable()
export class GitLabAppSupport {

    @inject(UserDB) protected readonly userDB: UserDB;
    @inject(TokenProvider) protected readonly tokenProvider: TokenProvider;

    async getProviderRepositoriesForUser(params: { user: User, provider: string, hints?: object }): Promise<ProviderRepository[]> {
        const token = await this.tokenProvider.getTokenForHost(params.user, "gitlab.com");
        const oauthToken = token.value;
        const api = new Gitlab({ oauthToken });

        const result: ProviderRepository[] = [];
        const ownersRepos: ProviderRepository[] = [];

        const identity = params.user.identities.find(i => i.authProviderId === "Public-GitLab");
        if (!identity) {
            return result;
        }
        const usersGitLabAccount = identity.authName;

        // cf. https://docs.gitlab.com/ee/api/projects.html#list-all-projects
        // we are listing only those projects with access level of maintainers.
        // also cf. https://docs.gitlab.com/ee/api/members.html#valid-access-levels
        //
        const projectsWithAccess = await api.Projects.all({ min_access_level: "40", perPage: 100 });
        for (const project of projectsWithAccess) {
            const anyProject = project as any;
            const fullPath = anyProject.path_with_namespace as string;
            const cloneUrl = anyProject.http_url_to_repo as string;
            const updatedAt = anyProject.last_activity_at as string;
            const accountAvatarUrl = anyProject.owner?.avatar_url as string;
            const account = fullPath.split("/")[0];

            (account === usersGitLabAccount ? ownersRepos : result).push({
                name: project.name,
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