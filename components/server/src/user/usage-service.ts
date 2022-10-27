/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";
import {
    CostCenter_BillingStrategy,
    UsageServiceClient,
    UsageServiceDefinition,
} from "@gitpod/usage-api/lib/usage/v1/usage.pb";
import { inject, injectable } from "inversify";

export const UsageService = Symbol("UsageService");

export interface UsageService {
    getCurrentBalance(attributionId: AttributionId): Promise<{ usedCredits: number; usageLimit: number }>;

    getCurrentBillingStategy(attributionId: AttributionId): Promise<CostCenter_BillingStrategy | undefined>;
}

@injectable()
export class UsageServiceImpl implements UsageService {
    @inject(UsageServiceDefinition.name)
    protected readonly usageService: UsageServiceClient;

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
}

// TODO(gpl) Remove as part of fixing https://github.com/gitpod-io/gitpod/issues/14129
export class NoOpUsageService implements UsageService {
    async getCurrentBalance(attributionId: AttributionId): Promise<{ usedCredits: number; usageLimit: number }> {
        return {
            usedCredits: 0,
            usageLimit: 1000000000,
        };
    }

    async getCurrentBillingStategy(attributionId: AttributionId): Promise<CostCenter_BillingStrategy | undefined> {
        return CostCenter_BillingStrategy.BILLING_STRATEGY_OTHER;
    }
}
