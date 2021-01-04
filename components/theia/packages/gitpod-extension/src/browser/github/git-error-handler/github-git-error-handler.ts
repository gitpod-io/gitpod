/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject } from "inversify";
import { GitErrorHandler } from "@theia/git/lib/browser/git-error-handler";
import { CommandService } from "@theia/core";
import { GitHubModel } from "../github-model";
import { GitHosterCommand } from "../../githoster/githoster-frontend-contribution";
import { github } from "../github-decorators";
import { GitHosterModel } from "../../githoster/model/githoster-model";

@injectable()
export class GitHubGitErrorHandler extends GitErrorHandler {

    @inject(CommandService) protected readonly commandService: CommandService;
    @inject(GitHosterModel) @github protected readonly gitHubModel: GitHubModel;

    handleError(error: any): void {
        const message = error instanceof Error ? error.message : error;
        if (message) {
            const isRepositoryAvailable = !!this.gitHubModel.base;
            if (this.isPermissionDenied(message) && isRepositoryAvailable) {
                this.showCreateOrSwitchForkMessage();
            } else {
                this.messageService.error(message, { timeout: 0 });
            }
        }
    }

    protected async showCreateOrSwitchForkMessage() {
        const myLogin = await this.gitHubModel.getMyLogin();
        if (myLogin === this.gitHubModel.base!.repository.owner) {
            // this case should be handled by the generic `git push` validation.
            return;
        }
        const repoFullName = this.gitHubModel.base!.repository.fullName;
        const action = "Switch Fork";
        const selection = await this.messageService.error(`You don't have write permissions for "${repoFullName}". Do you want to switch or create a fork?`, action);
        if (selection == action) {
            this.commandService.executeCommand(GitHosterCommand.fork.id);
        }
    }

    protected isPermissionDenied(errorMessage: string): boolean {
        console.log(`GitHubGitErrorHandler > error message: ${errorMessage}`);
        return errorMessage.includes("Authentication failed");
    }
}

