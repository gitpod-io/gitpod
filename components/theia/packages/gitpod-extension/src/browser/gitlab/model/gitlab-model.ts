/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Gitlab } from "gitlab";
import { inject, injectable } from "inversify";
import { GitHosterModel } from "../../githoster/model/githoster-model";
import { GitpodGitTokenProvider } from "../../gitpod-git-token-provider";
import { GitLabApiCommons } from "../gitlab-api-commons";
import { GitLabExtension } from "../gitlab-extension";

@injectable()
export class GitLabModel extends GitHosterModel {

    @inject(GitLabExtension)
    protected readonly extension: GitLabExtension;

    @inject(GitpodGitTokenProvider)
    protected readonly tokenProvider: GitpodGitTokenProvider;

    async gitlabApi() {
        const { host } = this.extension;
        const token = await this.tokenProvider.getGitToken({ host });
        return new Gitlab({
            oauthToken: token.token,
            host: `https://${host}`
        });
    }

    // TODO: implement me
    readonly pullRequest = undefined;

    async hasWritePermission(owner: string, repo: string): Promise<boolean> {
        const api = await this.gitlabApi();
        const currentUser = await GitLabApiCommons.getCurrentUser(api);
        if (!currentUser) {
            return Promise.reject("Could not find current user.");
        }
        // https://docs.gitlab.com/ee/api/members.html
        const result = (await api.ProjectMembers.all(`${owner}/${repo}`, { includeInherited: true, user_ids: [currentUser.id] })) as any;
        // const result = (await api.ProjectMembers.show(`${owner}/${repo}`, currentUser.id, { includeInherited: true })) as any;
        if (result && result.access_level) {
            console.log("GitLab: There is one resulting project member.")
            // https://docs.gitlab.com/ee/user/permissions.html
            if (result.access_level >= 30) {
                console.log("GitLab: The current user is at least 'Developer'.");
                return true;
            } else {
                console.log("GitLab: The current user is less than 'Developer'.");
                return false;
            }
        } else if (Array.isArray(result)) {
            console.log(`GitLab: There are ${result.length} resulting project members.`);
            const me = result.find(member => member.id === currentUser.id);
            if (!me) {
                console.log("GitLab: The current user is not a project member.");
                return false;
            }
            if (me.access_level && me.access_level >= 30) {
                console.log("GitLab: The current user is at least 'Developer'.");
                return true;
            } else {
                console.log("GitLab: The current user is less than 'Developer'.");
                return false;
            }
        } else {
            console.log("GitLab: User is not a project member.");
            return false;
        }
    }
}