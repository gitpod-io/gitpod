/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import {
    User,
    WorkspaceInstance,
    WorkspaceTimeoutDuration,
    WORKSPACE_TIMEOUT_DEFAULT_LONG,
    WORKSPACE_LIFETIME_LONG,
    MAX_PARALLEL_WORKSPACES_FREE,
    MAX_PARALLEL_WORKSPACES_PAID,
} from "@gitpod/gitpod-protocol";
import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";
import { BillingTier } from "@gitpod/gitpod-protocol/lib/protocol";
import { inject, injectable } from "inversify";
import { BillingModes } from "./billing-mode";
import { EntitlementServiceUBP, getRunningInstancesCount, LazyOrganizationService } from "./entitlement-service-ubp";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";

export interface MayStartWorkspaceResult {
    hitParallelWorkspaceLimit?: HitParallelWorkspaceLimit;

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
        organizationId: string,
        runningInstances: Promise<WorkspaceInstance[]>,
    ): Promise<MayStartWorkspaceResult>;

    /**
     * What amount of parallel workspaces a user may start based on their subscription
     * @param userId
     * @param organizationId
     * @returns the maximum number of parallel workspaces the user may start, or undefined if there is no limit
     */
    getMaxParallelWorkspaces(userId: string, organizationId: string): Promise<number | undefined>;

    /**
     * A user may set the workspace timeout if they have a professional subscription
     * @param userId
     * @param organizationId
     */
    maySetTimeout(userId: string, organizationId: string): Promise<boolean>;

    /**
     * Returns the default workspace timeout for the given user at a given point in time
     * @param userId
     * @param organizationId
     */
    getDefaultWorkspaceTimeout(userId: string, organizationId: string): Promise<WorkspaceTimeoutDuration>;

    /**
     * Returns the default workspace lifetime for the given user at a given point in time
     * @param userId
     * @param organizationId
     */
    getDefaultWorkspaceLifetime(userId: string, organizationId: string): Promise<WorkspaceTimeoutDuration>;

    /**
     * Returns true if network connections should be limited
     * @param userId
     * @param organizationId
     */
    limitNetworkConnections(userId: string, organizationId: string): Promise<boolean>;

    /**
     * Returns BillingTier of this organization
     *
     * @param userId
     * @param organizationId
     */
    getBillingTier(userId: string, organizationId: string): Promise<BillingTier>;
}

/**
 * The default implementation for the Enterprise Edition (EE). It decides based on config which ruleset to choose for each call.
 *
 * As a last safety net for rolling this out, it swallows all errors and turns them into log statements.
 */
@injectable()
export class EntitlementServiceImpl implements EntitlementService {
    constructor(
        @inject(BillingModes) private readonly billingModes: BillingModes,
        @inject(EntitlementServiceUBP) private readonly ubp: EntitlementServiceUBP,
        @inject(LazyOrganizationService) private readonly organizationService: LazyOrganizationService,
    ) {}

    async mayStartWorkspace(
        user: User,
        organizationId: string,
        runningInstances: Promise<WorkspaceInstance[]>,
    ): Promise<MayStartWorkspaceResult> {
        try {
            const billingMode = await this.billingModes.getBillingMode(user.id, organizationId);
            const organizationSettings = await this.organizationService().getSettings(user.id, organizationId);

            switch (billingMode.mode) {
                case "none":
                    // the default limit is MAX_PARALLEL_WORKSPACES_PAID, but organizations can set their own different limit
                    // we use || here because the default value is 0 and we want to use the default limit if the organization limit is not set
                    const maxParallelRunningWorkspaces =
                        organizationSettings.maxParallelRunningWorkspaces || MAX_PARALLEL_WORKSPACES_PAID;
                    const current = await getRunningInstancesCount(runningInstances);
                    if (current >= maxParallelRunningWorkspaces) {
                        return {
                            hitParallelWorkspaceLimit: {
                                current,
                                max: maxParallelRunningWorkspaces,
                            },
                        };
                    }

                    return {};
                case "usage-based":
                    return this.ubp.mayStartWorkspace(user, organizationId, runningInstances);
                default:
                    throw new Error("Unsupported billing mode: " + (billingMode as any).mode); // safety net
            }
        } catch (err) {
            log.warn({ userId: user.id }, "EntitlementService error: mayStartWorkspace", err);
            return {}; // When there is an EntitlementService error, we never want to break workspace starts
        }
    }

    async getMaxParallelWorkspaces(userId: string, organizationId: string): Promise<number | undefined> {
        try {
            const billingMode = await this.billingModes.getBillingMode(userId, organizationId);
            switch (billingMode.mode) {
                case "none":
                    return undefined;
                case "usage-based":
                    return this.ubp.getMaxParallelWorkspaces(userId, organizationId);
            }
        } catch (err) {
            log.warn({ userId }, "EntitlementService error: getMaxParallelWorkspaces", err);
            return MAX_PARALLEL_WORKSPACES_FREE;
        }
    }

    async maySetTimeout(userId: string, organizationId: string): Promise<boolean> {
        try {
            const billingMode = await this.billingModes.getBillingMode(userId, organizationId);
            switch (billingMode.mode) {
                case "none":
                    return true;
                case "usage-based":
                    return this.ubp.maySetTimeout(userId, organizationId);
            }
        } catch (err) {
            log.warn({ userId }, "EntitlementService error: maySetTimeout", err);
            return true;
        }
    }

    async getDefaultWorkspaceTimeout(userId: string, organizationId: string): Promise<WorkspaceTimeoutDuration> {
        try {
            const billingMode = await this.billingModes.getBillingMode(userId, organizationId);
            switch (billingMode.mode) {
                case "none":
                    return WORKSPACE_TIMEOUT_DEFAULT_LONG;
                case "usage-based":
                    return this.ubp.getDefaultWorkspaceTimeout(userId, organizationId);
            }
        } catch (err) {
            log.warn({ userId }, "EntitlementService error: getDefaultWorkspaceTimeout", err);
            return WORKSPACE_TIMEOUT_DEFAULT_LONG;
        }
    }

    async getDefaultWorkspaceLifetime(userId: string, organizationId: string): Promise<WorkspaceTimeoutDuration> {
        try {
            const billingMode = await this.billingModes.getBillingMode(userId, organizationId);
            switch (billingMode.mode) {
                case "none":
                    return WORKSPACE_LIFETIME_LONG;
                case "usage-based":
                    return this.ubp.getDefaultWorkspaceLifetime(userId, organizationId);
            }
        } catch (err) {
            log.warn({ userId }, "EntitlementService error: getDefaultWorkspaceLifetime", err);
            return WORKSPACE_LIFETIME_LONG;
        }
    }

    /**
     * Returns true if network connections should be limited
     * @param user
     */
    async limitNetworkConnections(userId: string, organizationId: string): Promise<boolean> {
        try {
            const billingMode = await this.billingModes.getBillingMode(userId, organizationId);
            switch (billingMode.mode) {
                case "none":
                    return false;
                case "usage-based":
                    return this.ubp.limitNetworkConnections(userId, organizationId);
            }
        } catch (err) {
            log.warn({ userId }, "EntitlementService error: limitNetworkConnections", err);
            return false;
        }
    }

    /**
     * Returns true if network connections should be limited
     * @param userId
     * @param organizationId
     */
    async getBillingTier(userId: string, organizationId: string): Promise<BillingTier> {
        try {
            const billingMode = await this.billingModes.getBillingMode(userId, organizationId);
            switch (billingMode.mode) {
                case "none":
                    return "paid";
                case "usage-based":
                    return billingMode.paid ? "paid" : "free";
            }
        } catch (err) {
            log.warn({ userId }, "EntitlementService error: getBillingTier", err);
            return "paid";
        }
    }
}
