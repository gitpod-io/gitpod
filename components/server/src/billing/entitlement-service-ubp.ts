/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { TeamDB } from "@gitpod/gitpod-db/lib";
import {
    WorkspaceInstance,
    WorkspaceTimeoutDuration,
    WORKSPACE_TIMEOUT_DEFAULT_LONG,
    WORKSPACE_TIMEOUT_DEFAULT_SHORT,
    WORKSPACE_LIFETIME_LONG,
    WORKSPACE_LIFETIME_SHORT,
    User,
    BillingTier,
    Team,
} from "@gitpod/gitpod-protocol";
import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";
import { inject, injectable } from "inversify";
import { EntitlementService, HitParallelWorkspaceLimit, MayStartWorkspaceResult } from "./entitlement-service";
import { CostCenter_BillingStrategy } from "@gitpod/usage-api/lib/usage/v1/usage.pb";
import { UsageService } from "../orgs/usage-service";

const MAX_PARALLEL_WORKSPACES_FREE = 4;
const MAX_PARALLEL_WORKSPACES_PAID = 16;

/**
 * EntitlementService implementation for Usage-Based Pricing (UBP)
 */
@injectable()
export class EntitlementServiceUBP implements EntitlementService {
    constructor(
        @inject(UsageService) private readonly usageService: UsageService,
        @inject(TeamDB) private readonly teamDB: TeamDB,
    ) {}

    async mayStartWorkspace(
        user: User,
        organizationId: string,
        runningInstances: Promise<WorkspaceInstance[]>,
    ): Promise<MayStartWorkspaceResult> {
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

    async maySetTimeout(userId: string, organizationId?: string): Promise<boolean> {
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

    private async hasPaidSubscription(userId: string, organizationId?: string): Promise<boolean> {
        if (organizationId) {
            // This is the "stricter", more correct version: We only allow privileges on the Organization that is paying for it
            const { billingStrategy } = await this.usageService.getCostCenter(userId, organizationId);
            return billingStrategy === CostCenter_BillingStrategy.BILLING_STRATEGY_STRIPE;
        }
        // This is the old behavior, stemming from our transition to PAYF, where our API did-/doesn't pass organizationId, yet
        // Member of paid team?
        const teams = await this.teamDB.findTeamsByUser(userId);
        const isTeamSubscribedPromises = teams.map(async (team: Team) => {
            const { billingStrategy } = await this.usageService.getCostCenter(userId, team.id);
            return billingStrategy === CostCenter_BillingStrategy.BILLING_STRATEGY_STRIPE;
        });
        // Return the first truthy promise, or false if all the promises were falsy.
        // Source: https://gist.github.com/jbreckmckye/66364021ebaa0785e426deec0410a235
        return new Promise((resolve, reject) => {
            // If any promise returns true, immediately resolve with true
            isTeamSubscribedPromises.forEach(async (isTeamSubscribedPromise: Promise<boolean>) => {
                const isTeamSubscribed = await isTeamSubscribedPromise;
                if (isTeamSubscribed) resolve(true);
            });

            // If neither of the above fires, resolve with false
            // Check truthiness just in case callbacks fire out-of-band
            Promise.all(isTeamSubscribedPromises)
                .then((areTeamsSubscribed) => {
                    resolve(!!areTeamsSubscribed.find((isTeamSubscribed: boolean) => !!isTeamSubscribed));
                })
                .catch(reject);
        });
    }

    async getBillingTier(userId: string, organizationId: string): Promise<BillingTier> {
        const hasPaidPlan = await this.hasPaidSubscription(userId, organizationId);
        return hasPaidPlan ? "paid" : "free";
    }
}
