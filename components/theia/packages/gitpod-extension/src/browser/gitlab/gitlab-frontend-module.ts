/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { ContainerModule } from "inversify";
import { ForkCreator } from "../githoster/fork/fork-creator";
import { ForksLoader } from "../githoster/fork/forks-loader";
import { GitHosterExtension } from "../githoster/githoster-extension";
import { GITHOSTER } from "../githoster/githoster-frontend-module";
import { GitLabForkCreator } from "./fork/gitlab-fork-creator";
import { GitLabForksLoader } from "./fork/gitlab-forks-loader";
import { GitLabExtension, GITLAB_ID } from "./gitlab-extension";
import { GitState } from "../githoster/git-state";
import { GitLabGitState } from "./gitlab-git-state";
import { GitHosterModel } from "../githoster/model/githoster-model";
import { GitLabModel } from "./model/gitlab-model";

export default new ContainerModule((bind, unbind, isBound, rebind) => {
    bind(GitLabExtension).toSelf().inSingletonScope();
    bind(GitHosterExtension).toService(GitLabExtension);

    bind<GitState>(GitState).to(GitLabGitState).inSingletonScope().whenTargetTagged(GITHOSTER, GITLAB_ID);

    bind<GitHosterModel>(GitHosterModel).to(GitLabModel).inSingletonScope().whenTargetTagged(GITHOSTER, GITLAB_ID);

    bind<ForksLoader>(ForksLoader).to(GitLabForksLoader).inSingletonScope().whenTargetTagged(GITHOSTER, GITLAB_ID);
    bind<ForkCreator>(ForkCreator.TYPE).to(GitLabForkCreator).inSingletonScope().whenTargetTagged(GITHOSTER, GITLAB_ID);
});
