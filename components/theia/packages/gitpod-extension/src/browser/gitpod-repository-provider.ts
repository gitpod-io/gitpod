/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject } from "inversify";
import { GitRepositoryProvider, GitRefreshOptions } from "@theia/git/lib/browser/git-repository-provider";
import { GitpodInfoService } from "../common/gitpod-info";
import { Repository } from "@theia/git/lib/common";
import URI from "@theia/core/lib/common/uri";

export interface GitpodGitRefreshOptions extends GitRefreshOptions {
    workspaceRootUri?: string;
}

@injectable()
export class GitpodRepositoryProvider extends GitRepositoryProvider {
    @inject(GitpodInfoService) protected readonly infoProvider: GitpodInfoService

    protected async initialize(): Promise<void> {
        const selectedRepository = await this.storageService.getData<Repository | undefined>(this.selectedRepoStorageKey);
        await super.initialize();
        // switch to repoRoot if there was no previous storage and the selected repository doesn't already point to repoRoot.
        if (!selectedRepository) {
            const info = await this.infoProvider.getInfo();
            if (!this.selectedRepository || this.selectedRepository.localUri !== info.repoRoot) {
                const repo = this.toGitRepository(this.scmService.findRepository(new URI(info.repoRoot)));
                this.selectedRepository = repo;
            }
        }
    }

}