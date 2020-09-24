/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject } from "inversify";

import { FrontendApplicationContribution } from "@theia/core/lib/browser";

import { GitpodInfoService } from "../../common/gitpod-info";
import { GitpodNotRunningOverlay } from "./gitpod-not-running-dialog";
import { GitpodServiceProvider } from "../gitpod-service-provider";
import { MessageService } from "@theia/core";
import { ConnectionStatusService } from "@theia/core/lib/browser/connection-status-service";


@injectable()
export class GitpodKeepAlivePolling implements FrontendApplicationContribution {

    @inject(GitpodInfoService) protected readonly gitpodInfoService: GitpodInfoService;
    @inject(GitpodServiceProvider) protected readonly gitpodServiceProvider: GitpodServiceProvider;
    @inject(MessageService) protected readonly messageService: MessageService;
    @inject(ConnectionStatusService) protected readonly connectionStatus: ConnectionStatusService;

    protected overlay: GitpodNotRunningOverlay;

    async onStart() {
        const info = await this.gitpodInfoService.getInfo()
        const service = this.gitpodServiceProvider.getService();
        this.overlay = new GitpodNotRunningOverlay(service, info, this.messageService, this.connectionStatus);
    }
}