/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { AuthProviderInfo, ProviderRepository, User } from "@gitpod/gitpod-protocol";
import { inject, injectable } from "inversify";
import { Gitlab } from "@gitbeaker/rest";
import { GitLab } from "./api";
import { TokenProvider } from "../user/token-provider";

@injectable()
export class GitLabAppSupport {
    @inject(TokenProvider) protected readonly tokenProvider: TokenProvider;

    async getProviderRepositoriesForUser(params: {
        user: User;
        provider: AuthProviderInfo;
    }): Promise<ProviderRepository[]> {
        const token = await this.tokenProvider.getTokenForHost(params.user, params.provider.host);
        const oauthToken = token.value;
        const api = new Gitlab({ oauthToken, host: `https://${params.provider.host}` });

        const result: ProviderRepository[] = [];
        const ownersRepos: ProviderRepository[] = [];

        const identity = params.user.identities.find((i) => i.authProviderId === params.provider.authProviderId);
        if (!identity) {
            return result;
        }
        const usersGitLabAccount = identity.authName;

        // cf. https://docs.gitlab.com/ee/api/projects.html#list-all-projects
        // we are listing only those projects with access level of maintainers.
        // also cf. https://docs.gitlab.com/ee/api/members.html#valid-access-levels
        //
        const projectsWithAccess = await api.Projects.all({
            minAccessLevel: 40,
            perPage: 100,
        });
        for (const project of projectsWithAccess) {
            const aProject = project as GitLab.Project;
            const path = aProject.path as string;
            const fullPath = aProject.path_with_namespace as string;
            const cloneUrl = aProject.http_url_to_repo as string;
            const updatedAt = aProject.last_activity_at as string;
            const accountAvatarUrl = await this.getAccountAvatarUrl(aProject, params.provider.host);
            const account = fullPath.split("/")[0];

            (account === usersGitLabAccount ? ownersRepos : result).push({
                name: project.name,
                path,
                account,
                cloneUrl,
                updatedAt,
                accountAvatarUrl,
                // inUse: // todo(at) compute usage via ProjectHooks API
            });
        }

        // put owner's repos first. the frontend will pick first account to continue with
        result.unshift(...ownersRepos);
        return result;
    }

    protected async getAccountAvatarUrl(project: GitLab.Project, providerHost: string): Promise<string> {
        let owner = project.owner;
        if (!owner && project.namespace && !project.namespace.parent_id) {
            // Fall back to "root namespace" / "top-level group"
            owner = project.namespace;
        }
        if (!owner) {
            // Could not determine account avatar
            return "";
        }
        if (owner.avatar_url) {
            const url = owner.avatar_url;
            // Sometimes GitLab avatar URLs are relative -- ensure we always use the correct host
            return url[0] === "/" ? `https://${providerHost}${url}` : url;
        }
        // If there is no avatar, generate the same default avatar that GitLab uses. Based on:
        // - https://gitlab.com/gitlab-org/gitlab/-/blob/b2a22b6e85200ce55ab09b5c765043441b086c96/app/helpers/avatars_helper.rb#L151-161
        // - https://gitlab.com/gitlab-org/gitlab/-/blob/861f52858a1db07bdb122fe947dec9b0a09ce807/app/assets/stylesheets/startup/startup-general.scss#L1611-1631
        // - https://gitlab.com/gitlab-org/gitlab/-/blob/861f52858a1db07bdb122fe947dec9b0a09ce807/app/assets/stylesheets/startup/startup-general.scss#L420-422
        const backgroundColors = ["#fcf1ef", "#f4f0ff", "#f1f1ff", "#e9f3fc", "#ecf4ee", "#fdf1dd", "#f0f0f0"];
        const backgroundColor = backgroundColors[owner.id % backgroundColors.length];
        // Uppercase first character of the name, support emojis, default to whitespace.
        const text = String.fromCodePoint(owner.name.codePointAt(0) || 32 /* space */).toUpperCase();
        const svg = `<svg viewBox="0 0 32 32" height="32" width="32" style="background-color: ${backgroundColor}" xmlns="http://www.w3.org/2000/svg">
            <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" style='font-size: 0.875rem; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans", Ubuntu, Cantarell, "Helvetica Neue", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"'>
                ${text}
            </text>
        </svg>`;
        return `data:image/svg+xml,${encodeURIComponent(svg.replace(/\s+/g, " "))}`;
    }
}
