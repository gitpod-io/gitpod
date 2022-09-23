/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { User } from "@gitpod/gitpod-protocol";
import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { UsageServiceClient, UsageServiceDefinition } from "@gitpod/usage-api/lib/usage/v1/usage.pb";
import { inject, injectable } from "inversify";
import { UserService } from "../../../src/user/user-service";

export interface UsageLimitReachedResult {
    reached: boolean;
    almostReached?: boolean;
    attributionId: AttributionId;
}

@injectable()
export class BillingService {
    @inject(UserService) protected readonly userService: UserService;
    @inject(UsageServiceDefinition.name)
    protected readonly usageService: UsageServiceClient;

    async checkUsageLimitReached(user: User): Promise<UsageLimitReachedResult> {
        const attributionId = await this.userService.getWorkspaceUsageAttributionId(user);
        const costCenter = (
            await this.usageService.getCostCenter({
                attributionId: AttributionId.render(attributionId),
            })
        ).costCenter;
        if (!costCenter) {
            const err = new Error("No CostCenter found");
            log.error({ userId: user.id }, err.message, err, { attributionId });
            // Technically we do not have any spending limit set, yet. But sending users down the "reached" path will fix this issues as well.
            return {
                reached: true,
                attributionId,
            };
        }

        const getBalanceResponse = await this.usageService.getBalance({
            attributionId: AttributionId.render(attributionId),
        });
        const currentInvoiceCredits = getBalanceResponse.credits;
        if (currentInvoiceCredits >= (costCenter.spendingLimit || 0)) {
            log.info({ userId: user.id }, "Usage limit reached", {
                attributionId,
                currentInvoiceCredits,
                usageLimit: costCenter.spendingLimit,
            });
            return {
                reached: true,
                attributionId,
            };
        } else if (currentInvoiceCredits > costCenter.spendingLimit * 0.8) {
            log.info({ userId: user.id }, "Usage limit almost reached", {
                attributionId,
                currentInvoiceCredits,
                usageLimit: costCenter.spendingLimit,
            });
            return {
                reached: false,
                almostReached: true,
                attributionId,
            };
        }

        return {
            reached: false,
            attributionId,
        };
    }
}
