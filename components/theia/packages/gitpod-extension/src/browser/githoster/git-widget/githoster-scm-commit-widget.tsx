/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { CommandService } from "@theia/core";
import { ScmCommitWidget } from "@theia/scm/lib/browser/scm-commit-widget";
import { ScmInput } from "@theia/scm/lib/browser/scm-input";
import { inject, injectable } from "inversify";
import * as React from "react";
import { GitState } from "../git-state";
import { GitHosterExtension } from "../githoster-extension";
import { WritePermissionsView } from "./write-permissions-view";
import { GitHosterModel } from "../model/githoster-model";

@injectable()
export class GitHosterScmCommitWidget extends ScmCommitWidget {

    @inject(CommandService) protected readonly commandService: CommandService;
    @inject(GitHosterExtension.CURRENT_HOSTER_NAME) protected readonly currentHoster: () => string | undefined;
    @inject(GitHosterModel.FACTORY_TYPE) protected readonly gitHosterModel: (hoster: string) => GitHosterModel;
    @inject(GitState.FACTORY_TYPE) protected readonly gitState: (hoster: string) => GitState;

    protected renderInput(input: ScmInput): React.ReactNode {
        return <React.Fragment>
            {this.currentHoster() && this.renderWritePermissionsView()}
            {super.renderInput(input)}
        </React.Fragment>;
    }

    protected renderWritePermissionsView(): React.ReactNode {
        return <WritePermissionsView gitHoster={this.gitHosterModel(this.currentHoster()!)} gitState={this.gitState(this.currentHoster() || "")} commandService={this.commandService} />;
    }

}