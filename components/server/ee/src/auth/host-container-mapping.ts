/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { injectable, interfaces } from "inversify";
import { HostContainerMapping } from "../../../src/auth/host-container-mapping";
import { gitlabContainerModuleEE } from "../gitlab/container-module";
import { bitbucketContainerModuleEE } from "../bitbucket/container-module";
import { gitHubContainerModuleEE } from "../github/container-module";
import { bitbucketServerContainerModuleEE } from "../bitbucket-server/container-module";

@injectable()
export class HostContainerMappingEE extends HostContainerMapping {
    public get(type: string): interfaces.ContainerModule[] | undefined {
        let modules = super.get(type) || [];

        switch (type) {
            case "GitLab":
                return (modules || []).concat([gitlabContainerModuleEE]);
            case "Bitbucket":
                return (modules || []).concat([bitbucketContainerModuleEE]);
            case "BitbucketServer":
                return (modules || []).concat([bitbucketServerContainerModuleEE]);
            case "GitHub":
                return (modules || []).concat([gitHubContainerModuleEE]);
            default:
                return modules;
        }
    }
}
