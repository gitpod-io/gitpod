/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { inject, injectable, postConstruct } from "inversify";
import { GitState } from "../githoster/git-state";
import { GitHosterModel } from "../githoster/model/githoster-model";
import { gitlab } from "./gitlab-decorators";

@injectable()
export class GitLabGitState extends GitState {

    @inject(GitHosterModel) @gitlab
    protected readonly gitHosterModel: GitHosterModel;

    @postConstruct()
    protected init(): void {
        super.init();
    }
}
