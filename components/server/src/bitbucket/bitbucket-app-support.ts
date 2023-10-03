/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

// @ts-nocheck
import { AuthProviderInfo, ProviderRepository, User } from "@gitpod/gitpod-protocol";
import { inject, injectable } from "inversify";
import { TokenProvider } from "../user/token-provider";
import { Bitbucket, Schema } from "bitbucket";
import { URL } from "url";

@injectable()
export class BitbucketAppSupport {
    @inject(TokenProvider) protected readonly tokenProvider: TokenProvider;

    async getProviderRepositoriesForUser(params: {
        user: User;
        provider: AuthProviderInfo;
    }): Promise<ProviderRepository[]> {
        const token = await this.tokenProvider.getTokenForHost(params.user, params.provider.host);
        const oauthToken = token.value;

        const api = new Bitbucket({
            notice: false,
            baseUrl: `https://api.${params.provider.host}/2.0`,
            auth: {
                token: oauthToken,
            },
        });

        const result: ProviderRepository[] = [];
        const ownersRepos: ProviderRepository[] = [];

        const identity = params.user.identities.find((i) => i.authProviderId === params.provider.authProviderId);
        if (!identity) {
            return result;
        }
        const usersBitbucketAccount = identity.authName;

        const workspaces =
            (await api.workspaces.getWorkspaces({ pagelen: 100 })).data.values?.map((w) => w.slug!) || [];

        const fetchAllRepos = async (workspace: string) => {
            const result: Schema.Repository[] = [];
            let page = 1;
            let hasMorePages = true;
            const pagelen = 100;

            while (hasMorePages) {
                const response = await api.repositories
                    .list({
                        workspace,
                        pagelen,
                        page,
                        role: "admin", // installation of webhooks is allowed for admins only
                    })
                    .catch((e) => {
                        console.error(e);
                    });
                if (response) {
                    result.push(...response.data.values);
                    hasMorePages = response.data.size! > pagelen * page;
                    page++;
                } else {
                    hasMorePages = false;
                }
            }
            return result;
        };

        const repos = (await Promise.all(workspaces.map((workspace) => fetchAllRepos(workspace)))).flat();

        for (const repo of repos) {
            let cloneUrl = repo.links!.clone.find((x: any) => x.name === "https").href;
            if (cloneUrl) {
                const url = new URL(cloneUrl);
                url.username = "";
                cloneUrl = url.toString();
            }
            const fullName = repo.full_name!;
            const updatedAt = repo.updated_on!;
            const accountAvatarUrl = repo.links!.avatar?.href!;
            const account = fullName.split("/")[0];

            (account === usersBitbucketAccount ? ownersRepos : result).push({
                name: repo.name!,
                account,
                cloneUrl,
                updatedAt,
                accountAvatarUrl,
            });
        }

        // put owner's repos first. the frontend will pick first account to continue with
        result.unshift(...ownersRepos);
        return result;
    }
}
