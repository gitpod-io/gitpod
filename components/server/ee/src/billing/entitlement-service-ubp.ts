/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { TeamDB, UserDB } from "@gitpod/gitpod-db/lib";
import {
    Team,
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
import { StripeService } from "../user/stripe-service";
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
    @inject(StripeService) protected readonly stripeService: StripeService;
    @inject(TeamDB) protected readonly teamDB: TeamDB;

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
        const [usageLimitReachedOnCostCenter, hitParallelWorkspaceLimit] = await Promise.all([
            this.checkUsageLimitReached(user, date),
            hasHitParallelWorkspaceLimit(),
        ]);
        return {
            usageLimitReachedOnCostCenter: usageLimitReachedOnCostCenter,
            hitParallelWorkspaceLimit,
        };
    }

    protected async checkUsageLimitReached(user: User, date: Date): Promise<AttributionId | undefined> {
        const result = await this.billingService.checkUsageLimitReached(user);
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
        const hasPaidPlan = await this.hasPaidSubscription(user, date);
        return !hasPaidPlan;
    }

    protected async hasPaidSubscription(user: User, date: Date): Promise<boolean> {
        // Paid user?
        const subscriptionId = await this.stripeService.findUncancelledSubscriptionByAttributionId(
            AttributionId.render({ kind: "user", userId: user.id }),
        );
        if (subscriptionId) {
            return true;
        }
        // Member of paid team?
        const teams = await this.teamDB.findTeamsByUser(user.id);
        const isTeamSubscribedPromises = teams.map(async (team: Team) => {
            const subscriptionId = await this.stripeService.findUncancelledSubscriptionByAttributionId(
                AttributionId.render({ kind: "team", teamId: team.id }),
            );
            return !!subscriptionId;
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
}
