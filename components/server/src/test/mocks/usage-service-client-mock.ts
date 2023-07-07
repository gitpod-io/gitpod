/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import {
    AddUsageCreditNoteResponse,
    CostCenter_BillingStrategy,
    GetBalanceResponse,
    GetCostCenterResponse,
    ListUsageRequest_Ordering,
    ListUsageResponse,
    ReconcileUsageResponse,
    ResetUsageResponse,
    SetCostCenterResponse,
    UsageServiceClient,
} from "@gitpod/usage-api/lib/usage/v1/usage.pb";
import { injectable } from "inversify";
import { CallOptions } from "nice-grpc-common";

@injectable()
export class UsageServiceClientMock implements UsageServiceClient {
    getCostCenter(
        request: { attributionId?: string | undefined },
        options?: CallOptions | undefined,
    ): Promise<GetCostCenterResponse> {
        throw new Error("Method not implemented.");
    }
    setCostCenter(
        request: {
            costCenter?:
                | {
                      attributionId?: string | undefined;
                      spendingLimit?: number | undefined;
                      billingStrategy?: CostCenter_BillingStrategy | undefined;
                      nextBillingTime?: Date | undefined;
                      billingCycleStart?: Date | undefined;
                  }
                | undefined;
        },
        options?: CallOptions | undefined,
    ): Promise<SetCostCenterResponse> {
        throw new Error("Method not implemented.");
    }
    reconcileUsage(
        request: { from?: Date | undefined; to?: Date | undefined },
        options?: CallOptions | undefined,
    ): Promise<ReconcileUsageResponse> {
        throw new Error("Method not implemented.");
    }
    resetUsage(request: {}, options?: CallOptions | undefined): Promise<ResetUsageResponse> {
        throw new Error("Method not implemented.");
    }
    listUsage(
        request: {
            attributionId?: string | undefined;
            from?: Date | undefined;
            to?: Date | undefined;
            order?: ListUsageRequest_Ordering | undefined;
            pagination?: { perPage?: number | undefined; page?: number | undefined } | undefined;
        },
        options?: CallOptions | undefined,
    ): Promise<ListUsageResponse> {
        throw new Error("Method not implemented.");
    }
    getBalance(
        request: { attributionId?: string | undefined },
        options?: CallOptions | undefined,
    ): Promise<GetBalanceResponse> {
        throw new Error("Method not implemented.");
    }
    addUsageCreditNote(
        request: {
            attributionId?: string | undefined;
            credits?: number | undefined;
            description?: string | undefined;
            userId?: string | undefined;
        },
        options?: CallOptions | undefined,
    ): Promise<AddUsageCreditNoteResponse> {
        throw new Error("Method not implemented.");
    }
}
