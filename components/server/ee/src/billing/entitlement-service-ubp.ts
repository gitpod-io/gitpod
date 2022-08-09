/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { UserDB } from "@gitpod/gitpod-db/lib";
import {
    User,
    WorkspaceInstance,
    WorkspaceTimeoutDuration,
    WORKSPACE_TIMEOUT_DEFAULT_LONG,
    WORKSPACE_TIMEOUT_DEFAULT_SHORT,
} from "@gitpod/gitpod-protocol";
import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";
import { inject, injectable } from "inversify";
import {
    EntitlementService,
    HitParallelWorkspaceLimit,
    MayStartWorkspaceResult,
} from "../../../src/billing/entitlement-service";
import { Config } from "../../../src/config";
import { BillingModes } from "./billing-mode";
import { BillingService } from "./billing-service";

const MAX_PARALLEL_WORKSPACES_FREE = 4;
const MAX_PARALLEL_WORKSPACES_PAID = 16;

/**
 * EntitlementService implementation for Usage-Based Pricing (UBP)
 */
@injectable()
export class EntitlementServiceUBP implements EntitlementService {
    @inject(Config) protected readonly config: Config;
    @inject(UserDB) protected readonly userDb: UserDB;
    @inject(BillingModes) protected readonly billingModes: BillingModes;
    @inject(BillingService) protected readonly billingService: BillingService;

    async mayStartWorkspace(
        user: User,
        date: Date,
        runningInstances: Promise<WorkspaceInstance[]>,
    ): Promise<MayStartWorkspaceResult> {
        const hasHitParallelWorkspaceLimit = async (): Promise<HitParallelWorkspaceLimit | undefined> => {
            const max = await this.getMaxParallelWorkspaces(user, date);
            const current = (await runningInstances).filter((i) => i.status.phase !== "preparing").length;
            if (current >= max) {
                return {
                    current,
                    max,
                };
            } else {
                return undefined;
            }
        };
        const [spendingLimitReachedOnCostCenter, hitParallelWorkspaceLimit] = await Promise.all([
            this.checkSpendingLimitReached(user, date),
            hasHitParallelWorkspaceLimit(),
        ]);
        const result = !spendingLimitReachedOnCostCenter && !hitParallelWorkspaceLimit;
        return {
            mayStart: result,
            spendingLimitReachedOnCostCenter,
            hitParallelWorkspaceLimit,
        };
    }

    protected async checkSpendingLimitReached(user: User, date: Date): Promise<AttributionId | undefined> {
        const result = await this.billingService.checkSpendingLimitReached(user);
        if (result.reached) {
            return result.attributionId;
        }
        return undefined;
    }

    protected async getMaxParallelWorkspaces(user: User, date: Date): Promise<number> {
        if (await this.hasPaidSubscription(user, date)) {
            return MAX_PARALLEL_WORKSPACES_PAID;
        } else {
            return MAX_PARALLEL_WORKSPACES_FREE;
        }
    }

    async maySetTimeout(user: User, date: Date): Promise<boolean> {
        return this.hasPaidSubscription(user, date);
    }

    async getDefaultWorkspaceTimeout(user: User, date: Date): Promise<WorkspaceTimeoutDuration> {
        if (await this.hasPaidSubscription(user, date)) {
            return WORKSPACE_TIMEOUT_DEFAULT_LONG;
        } else {
            return WORKSPACE_TIMEOUT_DEFAULT_SHORT;
        }
    }

    async userGetsMoreResources(user: User, date: Date = new Date()): Promise<boolean> {
        return this.hasPaidSubscription(user, date);
    }

    protected async hasPaidSubscription(user: User, date: Date): Promise<boolean> {
        // TODO(gpl) UBP personal: implement!
        return true;
    }
}
