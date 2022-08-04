/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { User, WorkspaceInstance, WorkspaceTimeoutDuration } from "@gitpod/gitpod-protocol";
import { inject, injectable } from "inversify";
import { EntitlementService } from "../../../src/billing/entitlement-service";
import { Config } from "../../../src/config";
import { MayStartWorkspaceResult } from "../user/eligibility-service";
import { EntitlementServiceChargebee } from "./entitlement-service-chargebee";
import { EntitlementServiceLicense } from "./entitlement-service-license";

/**
 * The default implementation for the Enterprise Edition (EE). It decides based on config which ruleset to choose for each call.
 */
@injectable()
export class EntitlementServiceImpl implements EntitlementService {
    @inject(Config) protected readonly config: Config;
    @inject(EntitlementServiceChargebee) protected readonly etsChargebee: EntitlementServiceChargebee;
    @inject(EntitlementServiceLicense) protected readonly etsLicense: EntitlementServiceLicense;

    async mayStartWorkspace(
        user: User,
        date: Date,
        runningInstances: Promise<WorkspaceInstance[]>,
    ): Promise<MayStartWorkspaceResult> {
        if (!this.config.enablePayment) {
            return await this.etsLicense.mayStartWorkspace(user, date, runningInstances);
        }
        return await this.etsChargebee.mayStartWorkspace(user, date, runningInstances);
    }

    async maySetTimeout(user: User, date: Date): Promise<boolean> {
        if (!this.config.enablePayment) {
            return await this.etsLicense.maySetTimeout(user, date);
        }
        return await this.etsChargebee.maySetTimeout(user, date);
    }

    async getDefaultWorkspaceTimeout(user: User, date: Date): Promise<WorkspaceTimeoutDuration> {
        if (!this.config.enablePayment) {
            return await this.etsLicense.getDefaultWorkspaceTimeout(user, date);
        }
        return await this.etsChargebee.getDefaultWorkspaceTimeout(user, date);
    }

    async userGetsMoreResources(user: User): Promise<boolean> {
        if (!this.config.enablePayment) {
            return await this.etsLicense.userGetsMoreResources(user);
        }
        return await this.etsChargebee.userGetsMoreResources(user);
    }
}
