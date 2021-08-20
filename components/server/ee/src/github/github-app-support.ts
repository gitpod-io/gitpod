/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { ProviderRepository, User } from "@gitpod/gitpod-protocol";
import { inject, injectable } from "inversify";
import { GithubApp } from "../prebuilds/github-app";
import { RequestError } from "@octokit/request-error";
import { TokenProvider } from "../../../src/user/token-provider";
import { UserDB } from "@gitpod/gitpod-db/lib";
import { Octokit, RestEndpointMethodTypes } from "@octokit/rest";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";

@injectable()
export class GitHubAppSupport {

    @inject(GithubApp) protected readonly githubApp: GithubApp;
    @inject(UserDB) protected readonly userDB: UserDB;
    @inject(TokenProvider) protected readonly tokenProvider: TokenProvider;

    async getProviderRepositoriesForUser(params: { user: User, provider: string, hints?: object }): Promise<ProviderRepository[]> {
        const { user, provider, hints } = params;
        const result: ProviderRepository[] = [];
        const probot = this.githubApp.server?.probotApp;
        if (!probot) {
            return result;
        }
        if (params.provider !== "github.com") {
            return result; // Just GitHub.com for now
        }

        const identity = user.identities.find(i => i.authProviderId === "Public-GitHub");
        if (!identity) {
            return result;
        }
        const usersGitHubAccount = identity.authName;

        const appApi = await probot.auth();

        const findInstallationForAccount = async (account: string) => {
            try {
                return await appApi.apps.getUserInstallation({ username: account })
            } catch (error) {
                if (error instanceof RequestError) {
                    // ignore 404 - not found
                } else {
                    log.debug(error);
                }
            }
        }
        const listReposForInstallation = async (installation: RestEndpointMethodTypes["apps"]["getUserInstallation"]["response"]) => {
            const sub = await probot.auth(installation.data.id);
            try {
                const accessibleRepos = await sub.apps.listReposAccessibleToInstallation({ per_page: 100 });
                return accessibleRepos.data.repositories.map(r => {
                    return {
                        name: r.name,
                        cloneUrl: r.clone_url,
                        account: r.owner.login,
                        accountAvatarUrl: r.owner?.avatar_url,
                        updatedAt: r.updated_at,
                        installationId: installation.data.id,
                        installationUpdatedAt: installation.data.updated_at
                    };
                });
            } catch (error) {
                if (error instanceof RequestError) {
                    // ignore 404 - not found
                } else {
                    log.debug(error);
                }
            }
        }

        const listReposAccessibleToInstallation = async (account: string) => {
            const installation = await findInstallationForAccount(account);
            if (installation) {
                return await listReposForInstallation(installation);
            }
        }

        const ownRepos = await listReposAccessibleToInstallation(usersGitHubAccount);
        if (ownRepos) {
            result.push(...ownRepos);
        }

        const organizations: string[] = [];
        try {
            const token = await this.tokenProvider.getTokenForHost(user, provider);
            if (token.scopes.includes("read:org")) {
                const api = new Octokit({
                    auth: token.value
                });
                const { data } = await api.orgs.listMembershipsForAuthenticatedUser();
                organizations.push(...data.map(o => o.organization.login));
            }
        } catch { }

        // Add Orgs we learned about from previous installations
        for (const org of (user.additionalData?.knownGitHubOrgs || [])) {
            if (!organizations.includes(org)) {
                organizations.unshift(org);
            }
        }
        for (const org of organizations) {
            const orgRepos = await listReposAccessibleToInstallation(org);
            if (orgRepos) {
                result.push(...orgRepos);
            }
        }

        // If hints contain an additional installationId, let's try to add the repos
        //
        const installationId = parseInt((hints as any)?.installationId, 10);
        if (!isNaN(installationId)) {
            if (!result.some(r => r.installationId === installationId)) {
                const installation = await appApi.apps.getInstallation({installation_id: installationId});
                if (installation) {
                    const additional = await listReposForInstallation(installation);
                    if (additional) {
                        for (const repo of additional) {
                            if (result.some(r => r.account === repo.account && r.name === repo.name)) {
                                continue; // avoid duplicates when switching between "selected repos" and "all repos"
                            }

                            // add at the beginning
                            result.unshift(repo);

                            // optionally store newly identified organization of a user,
                            // just because the `listMembershipsForAuthenticatedUser` operation of the GH API
                            // requires an extra permission of the org's maintainer.
                            user.additionalData = user.additionalData || {}
                            user.additionalData.knownGitHubOrgs = user.additionalData.knownGitHubOrgs || [ ];
                            if (!user.additionalData.knownGitHubOrgs.includes(repo.account)) {
                                user.additionalData.knownGitHubOrgs.push(repo.account);
                                await this.userDB.updateUserPartial(user);
                            }
                        }
                    }
                } else {
                    log.debug(`Provided installationId appears to be invalid.`, { installationId });
                }

            }
        }

        return result;
    }
}