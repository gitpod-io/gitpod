/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import {
    User,
    WorkspaceInstance,
    WorkspaceTimeoutDuration,
    WORKSPACE_TIMEOUT_DEFAULT_SHORT,
} from "@gitpod/gitpod-protocol";
import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";
import { BillingTier } from "@gitpod/gitpod-protocol/lib/protocol";
import { injectable } from "inversify";

export interface MayStartWorkspaceResult {
    hitParallelWorkspaceLimit?: HitParallelWorkspaceLimit;
    //** Out of Chargebee credits? */
    oufOfCredits?: boolean;

    needsVerification?: boolean;

    /** Usage-Based Pricing: AttributionId of the CostCenter that reached it's usage limit */
    usageLimitReachedOnCostCenter?: AttributionId;
}

export interface HitParallelWorkspaceLimit {
    max: number;
    current: number;
}

export const EntitlementService = Symbol("EntitlementService");
export interface EntitlementService {
    /**
     * Whether a user is allowed to start a workspace
     * !!! This is executed on the hot path of workspace startup, be careful with async when changing !!!
     * @param user
     * @param workspace
     * @param date now
     * @param runningInstances
     */
    mayStartWorkspace(
        user: User,
        organizationId: string | undefined,
        date: Date,
        runningInstances: Promise<WorkspaceInstance[]>,
    ): Promise<MayStartWorkspaceResult>;

    /**
     * A user may set the workspace timeout if they have a professional subscription
     * @param user
     * @param date The date for which we want to know whether the user is allowed to set a timeout (depends on active subscription)
     */
    maySetTimeout(user: User, date: Date): Promise<boolean>;

    /**
     * Returns the default workspace timeout for the given user at a given point in time
     * @param user
     * @param date The date for which we want to know the default workspace timeout (depends on active subscription)
     */
    getDefaultWorkspaceTimeout(user: User, date: Date): Promise<WorkspaceTimeoutDuration>;

    /**
     * Returns true if the user ought to land on a workspace cluster that provides more resources
     * compared to the default case.
     */
    userGetsMoreResources(user: User): Promise<boolean>;

    /**
     * Returns true if network connections should be limited
     * @param user
     */
    limitNetworkConnections(user: User, date: Date): Promise<boolean>;

    /**
     * Returns BillingTier of this particular user
     *
     * @param user
     */
    getBillingTier(user: User): Promise<BillingTier>;
}

/**
 * The default implementation that is used for the community edition.
 */
@injectable()
export class CommunityEntitlementService implements EntitlementService {
    async mayStartWorkspace(
        user: User,
        organizationId: string | undefined,
        date: Date,
        runningInstances: Promise<WorkspaceInstance[]>,
    ): Promise<MayStartWorkspaceResult> {
        return {};
    }

    async maySetTimeout(user: User, date: Date): Promise<boolean> {
        return true;
    }

    async getDefaultWorkspaceTimeout(user: User, date: Date): Promise<WorkspaceTimeoutDuration> {
        return WORKSPACE_TIMEOUT_DEFAULT_SHORT;
    }

    async userGetsMoreResources(user: User): Promise<boolean> {
        return false;
    }

    async limitNetworkConnections(user: User): Promise<boolean> {
        return false;
    }

    async getBillingTier(user: User): Promise<BillingTier> {
        return "free";
    }
}
