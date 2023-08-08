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
     * Returns the default workspace lifetime for the given user at a given point in time
     * @param user
     * @param date The date for which we want to know the default workspace timeout (depends on active subscription)
     */
    getDefaultWorkspaceLifetime(user: User, date: Date): Promise<WorkspaceTimeoutDuration>;

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
        date: Date = new Date(),
        runningInstances: Promise<WorkspaceInstance[]>,
    ): Promise<MayStartWorkspaceResult> {
        try {
            const verification = await this.verificationService.needsVerification(user);
            if (verification) {
                return {
                    needsVerification: true,
                };
            }
            const billingMode = await this.billingModes.getBillingModeForUser(user, date);
            switch (billingMode.mode) {
                case "none":
                    // if payment is not enabled users can start as many parallel workspaces as they want
                    return {};
                case "usage-based":
                    return this.ubp.mayStartWorkspace(user, organizationId, date, runningInstances);
                default:
                    throw new Error("Unsupported billing mode: " + (billingMode as any).mode); // safety net
            }
        } catch (err) {
            log.error({ userId: user.id }, "EntitlementService error: mayStartWorkspace", err);
            return {}; // When there is an EntitlementService error, we never want to break workspace starts
        }
    }

    async maySetTimeout(user: User, date: Date = new Date()): Promise<boolean> {
        try {
            const billingMode = await this.billingModes.getBillingModeForUser(user, date);
            switch (billingMode.mode) {
                case "none":
                    // when payment is disabled users can do everything
                    return true;
                case "usage-based":
                    return this.ubp.maySetTimeout(user, date);
            }
        } catch (err) {
            log.error({ userId: user.id }, "EntitlementService error: maySetTimeout", err);
            return true;
        }
    }

    async getDefaultWorkspaceTimeout(user: User, date: Date = new Date()): Promise<WorkspaceTimeoutDuration> {
        try {
            const billingMode = await this.billingModes.getBillingModeForUser(user, date);
            switch (billingMode.mode) {
                case "none":
                    return WORKSPACE_TIMEOUT_DEFAULT_LONG;
                case "usage-based":
                    return this.ubp.getDefaultWorkspaceTimeout(user, date);
            }
        } catch (err) {
            log.error({ userId: user.id }, "EntitlementService error: getDefaultWorkspaceTimeout", err);
            return WORKSPACE_TIMEOUT_DEFAULT_LONG;
        }
    }

    async getDefaultWorkspaceLifetime(user: User, date: Date = new Date()): Promise<WorkspaceTimeoutDuration> {
        try {
            const billingMode = await this.billingModes.getBillingModeForUser(user, date);
            switch (billingMode.mode) {
                case "none":
                    return WORKSPACE_LIFETIME_LONG;
                case "usage-based":
                    return this.ubp.getDefaultWorkspaceLifetime(user, date);
            }
        } catch (err) {
            log.error({ userId: user.id }, "EntitlementService error: getDefaultWorkspaceLifetime", err);
            return WORKSPACE_LIFETIME_LONG;
        }
    }

    async userGetsMoreResources(user: User, date: Date = new Date()): Promise<boolean> {
        try {
            const billingMode = await this.billingModes.getBillingModeForUser(user, date);
            switch (billingMode.mode) {
                case "none":
                    // TODO(gpl) Not sure this makes sense, but it's the way it was before
                    return false;
                case "usage-based":
                    return this.ubp.userGetsMoreResources(user);
            }
        } catch (err) {
            log.error({ userId: user.id }, "EntitlementService error: userGetsMoreResources", err);
            return true;
        }
    }

    /**
     * Returns true if network connections should be limited
     * @param user
     */
    async limitNetworkConnections(user: User, date: Date): Promise<boolean> {
        try {
            const billingMode = await this.billingModes.getBillingModeForUser(user, date);
            switch (billingMode.mode) {
                case "none":
                    return false;
                case "usage-based":
                    return this.ubp.limitNetworkConnections(user, date);
            }
        } catch (err) {
            log.error({ userId: user.id }, "EntitlementService error: limitNetworkConnections", err);
            return false;
        }
    }

    /**
     * Returns true if network connections should be limited
     * @param user
     */
    async getBillingTier(user: User): Promise<BillingTier> {
        try {
            const now = new Date();
            const billingMode = await this.billingModes.getBillingModeForUser(user, now);
            switch (billingMode.mode) {
                case "none":
                    // TODO(gpl) Is this true? Cross-check this whole interface with Self-Hosted before next release!
                    return "paid";
                case "usage-based":
                    return this.ubp.getBillingTier(user);
            }
        } catch (err) {
            log.error({ userId: user.id }, "EntitlementService error: getBillingTier", err);
            return "paid";
        }
    }
}
