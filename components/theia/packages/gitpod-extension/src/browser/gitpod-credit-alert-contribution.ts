/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject } from "inversify";

import { FrontendApplicationContribution } from "@theia/core/lib/browser";

import { GitpodInfoService } from "../common/gitpod-info";
import { GitpodServiceProvider } from "./gitpod-service-provider";
import { MessageService } from "@theia/core";
import { ConnectionStatusService } from "@theia/core/lib/browser/connection-status-service";
import { GitpodClient } from "@gitpod/gitpod-protocol";
import { GitpodHostUrl } from "@gitpod/gitpod-protocol/lib/util/gitpod-host-url";
import { formatHours } from "@gitpod/gitpod-protocol/lib/util/date-time";


@injectable()
export class GitpodCreditAlerContribution implements FrontendApplicationContribution {

    @inject(GitpodInfoService) protected readonly gitpodInfoService: GitpodInfoService;
    @inject(GitpodServiceProvider) protected readonly gitpodServiceProvider: GitpodServiceProvider;
    @inject(MessageService) protected readonly messageService: MessageService;
    @inject(ConnectionStatusService) protected readonly connectionStatus: ConnectionStatusService;

    async onStart() {
        const info = await this.gitpodInfoService.getInfo()
        const service = this.gitpodServiceProvider.getService();
        const onCreditAlert = (creditAlert: any /* CreditAlert */) => {
            if (creditAlert.remainingUsageHours > 0) {
                const action = 'Add Credits';
                this.messageService.warn(`Remaining usage time: ${formatHours(creditAlert.remainingUsageHours)}h`, { timeout: -1 }, action).then(result => {
                    if (action === result) {
                        const url = new GitpodHostUrl(info.host).asUpgradeSubscription().toString();
                        window.open(url, '_blank');
                    }
                });
            }
            const partialClient: Partial<GitpodClient> = {
                onCreditAlert   // IO concern
            } as Partial<GitpodClient>;
            service.registerClient(partialClient)
        }
    }

}