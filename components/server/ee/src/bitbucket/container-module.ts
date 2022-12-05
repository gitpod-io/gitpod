/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { ContainerModule } from "inversify";
import { BitbucketService } from "../prebuilds/bitbucket-service";
import { RepositoryService } from "../../../src/repohost/repo-service";

export const bitbucketContainerModuleEE = new ContainerModule((_bind, _unbind, _isBound, rebind) => {
    rebind(RepositoryService).to(BitbucketService).inSingletonScope();
});
