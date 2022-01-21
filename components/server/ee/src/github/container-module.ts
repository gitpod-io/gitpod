/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { ContainerModule } from 'inversify';
import { RepositoryService } from '../../../src/repohost/repo-service';
import { GitHubService } from '../prebuilds/github-service';

export const gitHubContainerModuleEE = new ContainerModule((_bind, _unbind, _isBound, rebind) => {
  rebind(RepositoryService).to(GitHubService).inSingletonScope();
});
