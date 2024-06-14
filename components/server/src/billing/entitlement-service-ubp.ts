/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import {
    WorkspaceInstance,
    WorkspaceTimeoutDuration,
    WORKSPACE_TIMEOUT_DEFAULT_LONG,
    WORKSPACE_TIMEOUT_DEFAULT_SHORT,
    WORKSPACE_LIFETIME_LONG,
    WORKSPACE_LIFETIME_SHORT,
    User,
    BillingTier,
} from "@gitpod/gitpod-protocol";
import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";
import { inject, injectable } from "inversify";
import { EntitlementService, HitParallelWorkspaceLimit, MayStartWorkspaceResult } from "./entitlement-service";
import { CostCenter_BillingStrategy } from "@gitpod/usage-api/lib/usage/v1/usage.pb";
import { UsageService } from "../orgs/usage-service";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { VerificationService } from "../auth/verification-service";

const MAX_PARALLEL_WORKSPACES_FREE = 4;
const MAX_PARALLEL_WORKSPACES_PAID = 16;

/**
 * EntitlementService implementation for Usage-Based Pricing (UBP)
 */
@injectable()
export class EntitlementServiceUBP implements EntitlementService {
    constructor(
        @inject(UsageService) private readonly usageService: UsageService,
        @inject(VerificationService) private readonly verificationService: VerificationService,
    ) {}

    async mayStartWorkspace(
        user: User,
        organizationId: string,
        runningInstances: Promise<WorkspaceInstance[]>,
    ): Promise<MayStartWorkspaceResult> {
        const verification = await this.verificationService.needsVerification(user);
        if (verification) {
            return {
                needsVerification: true,
            };
        }

        const hasHitParallelWorkspaceLimit = async (): Promise<HitParallelWorkspaceLimit | undefined> => {
            const max = await this.getMaxParallelWorkspaces(user.id, organizationId);
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
        const [usageLimitReachedOnCostCenter, hitParallelWorkspaceLimit] = await Promise.all([
            this.checkUsageLimitReached(user.id, organizationId),
            hasHitParallelWorkspaceLimit(),
        ]);
        return {
            usageLimitReachedOnCostCenter: usageLimitReachedOnCostCenter,
            hitParallelWorkspaceLimit,
        };
    }

    private async checkUsageLimitReached(userId: string, organizationId: string): Promise<AttributionId | undefined> {
        const result = await this.usageService.checkUsageLimitReached(userId, organizationId);
        if (result.reached) {
            return result.attributionId;
        }
        return undefined;
    }

    private async getMaxParallelWorkspaces(userId: string, organizationId: string): Promise<number> {
        if (await this.hasPaidSubscription(userId, organizationId)) {
            return MAX_PARALLEL_WORKSPACES_PAID;
        } else {
            return MAX_PARALLEL_WORKSPACES_FREE;
        }
    }

    async maySetTimeout(userId: string, organizationId: string): Promise<boolean> {
        return this.hasPaidSubscription(userId, organizationId);
    }

    async getDefaultWorkspaceTimeout(userId: string, organizationId: string): Promise<WorkspaceTimeoutDuration> {
        if (await this.hasPaidSubscription(userId, organizationId)) {
            return WORKSPACE_TIMEOUT_DEFAULT_LONG;
        } else {
            return WORKSPACE_TIMEOUT_DEFAULT_SHORT;
        }
    }

    async getDefaultWorkspaceLifetime(userId: string, organizationId: string): Promise<WorkspaceTimeoutDuration> {
        if (await this.hasPaidSubscription(userId, organizationId)) {
            return WORKSPACE_LIFETIME_LONG;
        } else {
            return WORKSPACE_LIFETIME_SHORT;
        }
    }

    /**
     * Returns true if network connections should be limited
     * @param user
     */
    async limitNetworkConnections(userId: string, organizationId: string): Promise<boolean> {
        // gpl: Because with the current payment handling (pay-after-use) having a "paid" plan is not a good enough classifier for trushworthyness atm.
        // We're looking into improving this, but for the meantime we limit network connections for everybody to reduce the impact of abuse.
        return true;
    }

    private async hasPaidSubscription(userId: string, organizationId: string): Promise<boolean> {
        try {
            // This is the "stricter", more correct version: We only allow privileges on the Organization that is paying for it
            const { billingStrategy } = await this.usageService.getCostCenter(userId, organizationId);
            return billingStrategy === CostCenter_BillingStrategy.BILLING_STRATEGY_STRIPE;
        } catch (err) {
            log.warn({ userId, organizationId }, "Error checking if user is subscribed to organization", err);
            return false;
        }
    }

    async getBillingTier(userId: string, organizationId: string): Promise<BillingTier> {
        const hasPaidPlan = await this.hasPaidSubscription(userId, organizationId);
        return hasPaidPlan ? "paid" : "free";
    }
}
