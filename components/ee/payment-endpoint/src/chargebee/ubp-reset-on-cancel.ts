/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { UsageServiceClient, UsageServiceDefinition } from "@gitpod/usage-api/lib/usage/v1/usage.pb";
import { inject, injectable } from "inversify";

@injectable()
export class UbpResetOnCancel {
    @inject(UsageServiceDefinition.name) protected readonly usageService: UsageServiceClient;

    async resetUsage(userId: string) {
        try {
            const attributionId = AttributionId.render({ kind: "user", userId: userId });
            const balanceResponse = await this.usageService.getBalance({ attributionId });
            const balance = balanceResponse.credits;
            log.info({ userId }, "Chargbee subscription cancelled, adding credit note for remaining balance", {
                balance,
                attributionId,
            });
            if (balance > 0) {
                await this.usageService.addUsageCreditNote({
                    attributionId,
                    credits: balance,
                    description: "Resetting balance after chargebee subscription cancellation",
                });
            } else {
                log.info({ userId }, "No balance to reset", { balance, attributionId });
            }
        } catch (err) {
            log.error({ userId }, "Failed to reset usage balance", err);
        }
    }
}
