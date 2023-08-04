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
} from "@gitpod/gitpod-protocol";
import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";
import { BillingTier } from "@gitpod/gitpod-protocol/lib/protocol";
import { inject, injectable } from "inversify";
import { Config } from "../config";
import { BillingModes } from "./billing-mode";
import { EntitlementServiceUBP } from "./entitlement-service-ubp";
import { VerificationService } from "../auth/verification-service";
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
     * A user may set the workspace timeout if they have a professional subscription
     * @param userId
     * @param organizationId
     */
    maySetTimeout(userId: string, organizationId?: string): Promise<boolean>;

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
    @inject(Config) protected readonly config: Config;
    @inject(BillingModes) protected readonly billingModes: BillingModes;
    @inject(EntitlementServiceUBP) protected readonly ubp: EntitlementServiceUBP;
    @inject(VerificationService) protected readonly verificationService: VerificationService;

    async mayStartWorkspace(
        user: User,
        organizationId: string,
        runningInstances: Promise<WorkspaceInstance[]>,
    ): Promise<MayStartWorkspaceResult> {
        try {
            const verification = await this.verificationService.needsVerification(user);
            if (verification) {
                return {
                    needsVerification: true,
                };
            }
            const billingMode = await this.billingModes.getBillingMode(user.id, organizationId);
            switch (billingMode.mode) {
                case "none":
                    // if payment is not enabled users can start as many parallel workspaces as they want
                    return {};
                case "usage-based":
                    return this.ubp.mayStartWorkspace(user, organizationId, runningInstances);
                default:
                    throw new Error("Unsupported billing mode: " + (billingMode as any).mode); // safety net
            }
        } catch (err) {
            log.error({ userId: user.id }, "EntitlementService error: mayStartWorkspace", err);
            return {}; // When there is an EntitlementService error, we never want to break workspace starts
        }
    }

    async maySetTimeout(userId: string, organizationId?: string): Promise<boolean> {
        try {
            // TODO(gpl): We need to replace this with ".getBillingMode(user.id, organizationId);" once all callers forward organizationId
            const billingMode = await this.billingModes.getBillingModeForUser();
            switch (billingMode.mode) {
                case "none":
                    // when payment is disabled users can do everything
                    return true;
                case "usage-based":
                    return this.ubp.maySetTimeout(userId, organizationId);
            }
        } catch (err) {
            log.error({ userId }, "EntitlementService error: maySetTimeout", err);
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
            log.error({ userId }, "EntitlementService error: getDefaultWorkspaceTimeout", err);
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
            log.error({ userId }, "EntitlementService error: getDefaultWorkspaceLifetime", err);
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
            log.error({ userId }, "EntitlementService error: limitNetworkConnections", err);
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
            log.error({ userId }, "EntitlementService error: getBillingTier", err);
            return "paid";
        }
    }
}
