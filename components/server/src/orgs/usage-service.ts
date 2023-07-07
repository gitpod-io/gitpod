/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import {
    CostCenter_BillingStrategy,
    UsageServiceClient,
    UsageServiceDefinition,
} from "@gitpod/usage-api/lib/usage/v1/usage.pb";
import { inject, injectable } from "inversify";

@injectable()
export class UsageService {
    constructor(@inject(UsageServiceDefinition.name) private readonly usageService: UsageServiceClient) {}

    async getCurrentBalance(attributionId: AttributionId): Promise<{ usedCredits: number; usageLimit: number }> {
        const costCenterPromise = this.usageService.getCostCenter({
            attributionId: AttributionId.render(attributionId),
        });
        const getBalanceResponse = await this.usageService.getBalance({
            attributionId: AttributionId.render(attributionId),
        });
        const costCenter = (await costCenterPromise).costCenter;
        const currentInvoiceCredits = getBalanceResponse.credits;

        return {
            usedCredits: currentInvoiceCredits,
            usageLimit: costCenter?.spendingLimit || 0,
        };
    }

    async getCurrentBillingStategy(attributionId: AttributionId): Promise<CostCenter_BillingStrategy | undefined> {
        const response = await this.usageService.getCostCenter({
            attributionId: AttributionId.render(attributionId),
        });
        return response.costCenter?.billingStrategy;
    }

    async checkUsageLimitReached(userId: string, organizationId: string): Promise<UsageLimitReachedResult> {
        const attributionId = AttributionId.createFromOrganizationId(organizationId);
        const creditBalance = await this.getCurrentBalance(attributionId);
        const currentInvoiceCredits = creditBalance.usedCredits;
        const usageLimit = creditBalance.usageLimit;
        if (currentInvoiceCredits >= usageLimit) {
            log.info({ userId }, "Usage limit reached", {
                attributionId,
                currentInvoiceCredits,
                usageLimit,
            });
            return {
                reached: true,
                attributionId,
            };
        } else if (currentInvoiceCredits > usageLimit * 0.8) {
            log.info({ userId }, "Usage limit almost reached", {
                attributionId,
                currentInvoiceCredits,
                usageLimit,
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

export interface UsageLimitReachedResult {
    reached: boolean;
    almostReached?: boolean;
    attributionId: AttributionId;
}
