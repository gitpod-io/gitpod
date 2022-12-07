/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { ContainerModule } from "inversify";
import { RepositoryService } from "../../../src/repohost/repo-service";
import { GitHubService } from "../prebuilds/github-service";

export const gitHubContainerModuleEE = new ContainerModule((_bind, _unbind, _isBound, rebind) => {
    rebind(RepositoryService).to(GitHubService).inSingletonScope();
});
