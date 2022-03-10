/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { injectable, interfaces } from "inversify";
import { HostContainerMapping } from "../../../src/auth/host-container-mapping";
import { gitlabContainerModuleEE } from "../gitlab/container-module";
import { bitbucketContainerModuleEE } from "../bitbucket/container-module";
import { giteaContainerModuleEE } from "../gitea/container-module";
import { gitHubContainerModuleEE } from "../github/container-module";

@injectable()
export class HostContainerMappingEE extends HostContainerMapping {
    public get(type: string): interfaces.ContainerModule[] | undefined {
        let modules = super.get(type) || [];

        switch (type) {
        case "GitLab":
            return (modules || []).concat([gitlabContainerModuleEE]);
        case "Bitbucket":
            return (modules || []).concat([bitbucketContainerModuleEE]);
        // case "BitbucketServer":
            // FIXME
            // return (modules || []).concat([bitbucketContainerModuleEE]);
        case "GitHub":
            return (modules || []).concat([gitHubContainerModuleEE]);
        case "Gitea":
              return (modules || []).concat([giteaContainerModuleEE]);
        default:
            return modules;
        }
    }
}
