/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import {
    AddUsageCreditNoteRequest,
    CostCenter,
    CostCenter_BillingStrategy,
    GetBalanceRequest,
    GetCostCenterResponse,
    ListUsageRequest,
    SetCostCenterResponse,
    UsageServiceClient,
} from "@gitpod/usage-api/lib/usage/v1/usage.pb";
import { injectable } from "inversify";

@injectable()
export class UsageServiceClientMock implements Partial<UsageServiceClient> {
    private costCenters: Map<string, CostCenter> = new Map();

    getCostCenter(request: { attributionId?: string | undefined }): Promise<GetCostCenterResponse> {
        if (!request.attributionId) {
            throw new Error("attributionId is required");
        }
        let costCenter = this.costCenters.get(request.attributionId);
        // if we don't have one we create a new one
        if (!costCenter) {
            costCenter = {
                attributionId: request.attributionId,
                spendingLimit: 0,
                billingStrategy: CostCenter_BillingStrategy.BILLING_STRATEGY_OTHER,
                nextBillingTime: new Date(),
                billingCycleStart: new Date(),
            };
            this.costCenters.set(request.attributionId, costCenter);
        }

        return Promise.resolve({
            costCenter,
        });
    }
    async setCostCenter(request: {
        costCenter?:
            | {
                  attributionId?: string | undefined;
                  spendingLimit?: number | undefined;
                  billingStrategy?: CostCenter_BillingStrategy | undefined;
                  nextBillingTime?: Date | undefined;
                  billingCycleStart?: Date | undefined;
              }
            | undefined;
    }): Promise<SetCostCenterResponse> {
        // update an existing cost center
        if (request.costCenter?.attributionId) {
            const costCenter = this.costCenters.get(request.costCenter.attributionId);
            if (costCenter) {
                this.costCenters.set(request.costCenter.attributionId, {
                    ...costCenter,
                    ...request.costCenter,
                });
                return {
                    costCenter,
                };
            }
        }
        throw new Error("cost center not found");
    }

    async listUsage(req: ListUsageRequest) {
        return {
            creditsUsed: 0,
            pagination: {
                page: 1,
                perPage: 10,
                total: 30,
                totalPages: 3,
            },
            usageEntries: [],
            ledgerInterval: {
                seconds: 60,
                nanos: 0,
            },
        };
    }
    async getBalance(req: GetBalanceRequest) {
        return {
            credits: 0,
        };
    }
    async addUsageCreditNote(req: AddUsageCreditNoteRequest) {
        return {};
    }
}
