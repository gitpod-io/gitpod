/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { TeamDB } from "@gitpod/gitpod-db/lib";
import {
    BillingTier,
    Team,
    User,
    WorkspaceInstance,
    WorkspaceTimeoutDuration,
    WORKSPACE_TIMEOUT_DEFAULT_LONG,
    WORKSPACE_TIMEOUT_DEFAULT_SHORT,
    WORKSPACE_LIFETIME_LONG,
    WORKSPACE_LIFETIME_SHORT,
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
        const [usageLimitReachedOnCostCenter, hitParallelWorkspaceLimit] = await Promise.all([
            this.checkUsageLimitReached(user, organizationId, date),
            hasHitParallelWorkspaceLimit(),
        ]);
        return {
            usageLimitReachedOnCostCenter: usageLimitReachedOnCostCenter,
            hitParallelWorkspaceLimit,
        };
    }

    private async checkUsageLimitReached(
        user: User,
        organizationId: string,
        date: Date,
    ): Promise<AttributionId | undefined> {
        const result = await this.usageService.checkUsageLimitReached(user.id, organizationId);
        if (result.reached) {
            return result.attributionId;
        }
        return undefined;
    }

    private async getMaxParallelWorkspaces(user: User, date: Date): Promise<number> {
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

    async getDefaultWorkspaceLifetime(user: User, date: Date): Promise<WorkspaceTimeoutDuration> {
        if (await this.hasPaidSubscription(user, date)) {
            return WORKSPACE_LIFETIME_LONG;
        } else {
            return WORKSPACE_LIFETIME_SHORT;
        }
    }

    /**
     * DEPRECATED: With usage-based billing, users can choose exactly how many resources they want to get.
     * Thus, we no longer need to "force" extra resources via the `userGetsMoreResources` mechanism.
     */
    async userGetsMoreResources(user: User, date: Date = new Date()): Promise<boolean> {
        return false;
    }

    /**
     * Returns true if network connections should be limited
     * @param user
     */
    async limitNetworkConnections(user: User, date: Date): Promise<boolean> {
        // gpl: Because with the current payment handling (pay-after-use) having a "paid" plan is not a good enough classifier for trushworthyness atm.
        // We're looking into improving this, but for the meantime we limit network connections for everybody to reduce the impact of abuse.
        return true;
    }

    private async hasPaidSubscription(user: User, date: Date): Promise<boolean> {
        // Member of paid team?
        const teams = await this.teamDB.findTeamsByUser(user.id);
        const isTeamSubscribedPromises = teams.map(async (team: Team) => {
            const { billingStrategy } = await this.usageService.getCostCenter(user.id, team.id);
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

    async getBillingTier(user: User): Promise<BillingTier> {
        const hasPaidPlan = await this.hasPaidSubscription(user, new Date());
        return hasPaidPlan ? "paid" : "free";
    }
}
