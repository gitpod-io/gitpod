/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, interfaces } from "inversify";
import { githubContainerModule } from "../github/github-container-module";
import { gitlabContainerModule } from "../gitlab/gitlab-container-module";
import { genericAuthContainerModule } from "./oauth-container-module";
import { bitbucketContainerModule } from "../bitbucket/bitbucket-container-module";
import { bitbucketServerContainerModule } from "../bitbucket-server/bitbucket-server-container-module";

@injectable()
export class HostContainerMapping {

    public get(type: string): interfaces.ContainerModule[] | undefined {
        switch (type) {
        case "GitHub":
            return [githubContainerModule];
        case "GitLab":
            return [gitlabContainerModule];
        case "OAuth":
            return [genericAuthContainerModule];
        case "Bitbucket":
            return [bitbucketContainerModule];
        case "BitbucketServer":
            return [bitbucketServerContainerModule];
        default:
            return undefined;
        }
    }

}