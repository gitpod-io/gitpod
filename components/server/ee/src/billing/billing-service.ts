/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { CostCenterDB } from "@gitpod/gitpod-db/lib";
import { User } from "@gitpod/gitpod-protocol";
import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";
import { BillableSession, BillableSessionRequest, SortOrder } from "@gitpod/gitpod-protocol/lib/usage";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { UsageService, UsageServiceClientProvider } from "@gitpod/usage-api/lib/usage/v1/sugar";
import { Timestamp } from "google-protobuf/google/protobuf/timestamp_pb";
import { inject, injectable } from "inversify";
import { UserService } from "../../../src/user/user-service";

export interface SpendingLimitReachedResult {
    reached: boolean;
    almostReached?: boolean;
    attributionId: AttributionId;
}

@injectable()
export class BillingService {
    @inject(UserService) protected readonly userService: UserService;
    @inject(CostCenterDB) protected readonly costCenterDB: CostCenterDB;
    @inject(UsageServiceClientProvider) protected readonly usageServiceClientProvider: UsageServiceClientProvider;

    async checkSpendingLimitReached(user: User): Promise<SpendingLimitReachedResult> {
        const attributionId = await this.userService.getWorkspaceUsageAttributionId(user);
        const costCenter = !!attributionId && (await this.costCenterDB.findById(AttributionId.render(attributionId)));
        if (!costCenter) {
            const err = new Error("No CostCenter found");
            log.error({ userId: user.id }, err.message, err, { attributionId });
            throw err;
        }

        const allSessions = await this.listBilledUsage({
            attributionId: AttributionId.render(attributionId),
            startedTimeOrder: SortOrder.Descending,
        });
        const totalUsage = allSessions.map((s) => s.credits).reduce((a, b) => a + b, 0);
        if (totalUsage >= costCenter.spendingLimit) {
            return {
                reached: true,
                attributionId,
            };
        } else if (totalUsage > costCenter.spendingLimit * 0.8) {
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

    // TODO (gpl): Replace this with call to stripeService.getInvoice()
    async listBilledUsage(req: BillableSessionRequest): Promise<BillableSession[]> {
        const { attributionId, startedTimeOrder, from, to } = req;
        let timestampFrom;
        let timestampTo;

        if (from) {
            timestampFrom = Timestamp.fromDate(new Date(from));
        }
        if (to) {
            timestampTo = Timestamp.fromDate(new Date(to));
        }
        const usageClient = this.usageServiceClientProvider.getDefault();
        const response = await usageClient.listBilledUsage(
            {},
            attributionId,
            startedTimeOrder as number,
            timestampFrom,
            timestampTo,
        );
        const sessions = response.getSessionsList().map((s) => UsageService.mapBilledSession(s));
        return sessions;
    }
}
