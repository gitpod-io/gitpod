/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import {
    BillingTier,
    User,
    Workspace,
    WorkspaceInstance,
    WorkspaceTimeoutDuration,
    WORKSPACE_TIMEOUT_DEFAULT_LONG,
} from "@gitpod/gitpod-protocol";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { inject, injectable } from "inversify";
import { VerificationService } from "../../../src/auth/verification-service";
import { EntitlementService, MayStartWorkspaceResult } from "../../../src/billing/entitlement-service";
import { Config } from "../../../src/config";
import { BillingModes } from "./billing-mode";
import { EntitlementServiceChargebee } from "./entitlement-service-chargebee";
import { EntitlementServiceLicense } from "./entitlement-service-license";
import { EntitlementServiceUBP } from "./entitlement-service-ubp";

/**
 * The default implementation for the Enterprise Edition (EE). It decides based on config which ruleset to choose for each call.
 *
 * As a last safety net for rolling this out, it swallows all errors and turns them into log statements.
 */
@injectable()
export class EntitlementServiceImpl implements EntitlementService {
    @inject(Config) protected readonly config: Config;
    @inject(BillingModes) protected readonly billingModes: BillingModes;
    @inject(EntitlementServiceChargebee) protected readonly chargebee: EntitlementServiceChargebee;
    @inject(EntitlementServiceLicense) protected readonly license: EntitlementServiceLicense;
    @inject(EntitlementServiceUBP) protected readonly ubp: EntitlementServiceUBP;
    @inject(VerificationService) protected readonly verificationService: VerificationService;

    async mayStartWorkspace(
        user: User,
        workspace: Workspace,
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
                    return this.license.mayStartWorkspace(user, workspace, date, runningInstances);
                case "chargebee":
                    return this.chargebee.mayStartWorkspace(user, workspace, date, runningInstances);
                case "usage-based":
                    return this.ubp.mayStartWorkspace(user, workspace, date, runningInstances);
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
                    return this.license.maySetTimeout(user, date);
                case "chargebee":
                    return this.chargebee.maySetTimeout(user, date);
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
                    return this.license.getDefaultWorkspaceTimeout(user, date);
                case "chargebee":
                    return this.chargebee.getDefaultWorkspaceTimeout(user, date);
                case "usage-based":
                    return this.ubp.getDefaultWorkspaceTimeout(user, date);
            }
        } catch (err) {
            log.error({ userId: user.id }, "EntitlementService error: getDefaultWorkspaceTimeout", err);
            return WORKSPACE_TIMEOUT_DEFAULT_LONG;
        }
    }

    async userGetsMoreResources(user: User, date: Date = new Date()): Promise<boolean> {
        try {
            const billingMode = await this.billingModes.getBillingModeForUser(user, date);
            switch (billingMode.mode) {
                case "none":
                    return this.license.userGetsMoreResources(user);
                case "chargebee":
                    return this.chargebee.userGetsMoreResources(user);
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
                    return this.license.limitNetworkConnections(user, date);
                case "chargebee":
                    return this.chargebee.limitNetworkConnections(user, date);
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
                    return this.license.getBillingTier(user);
                case "chargebee":
                    return this.chargebee.getBillingTier(user);
                case "usage-based":
                    return this.ubp.getBillingTier(user);
            }
        } catch (err) {
            log.error({ userId: user.id }, "EntitlementService error: getBillingTier", err);
            return "paid";
        }
    }
}
