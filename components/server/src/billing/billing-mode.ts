/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { inject, injectable } from "inversify";

import { Team, User } from "@gitpod/gitpod-protocol";
import { Config } from "../config";
import { BillingMode } from "@gitpod/gitpod-protocol/lib/billing-mode";
import { TeamDB, UserDB } from "@gitpod/gitpod-db/lib";
import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";
import { CostCenter_BillingStrategy } from "@gitpod/usage-api/lib/usage/v1/usage.pb";
import { UsageService } from "../user/usage-service";

export const BillingModes = Symbol("BillingModes");
export interface BillingModes {
    getBillingMode(attributionId: AttributionId, now: Date): Promise<BillingMode>;
    getBillingModeForUser(user: User, now: Date): Promise<BillingMode>;
    getBillingModeForTeam(team: Team, now: Date): Promise<BillingMode>;
}

/**
 * Decides on a per org (legcay: also per-user) basis which BillingMode to use: "none" or "usage-based"
 */
@injectable()
export class BillingModesImpl implements BillingModes {
    @inject(Config) protected readonly config: Config;
    @inject(UsageService) protected readonly usageService: UsageService;
    @inject(TeamDB) protected readonly teamDB: TeamDB;
    @inject(UserDB) protected readonly userDB: UserDB;

    public async getBillingMode(attributionId: AttributionId, now: Date): Promise<BillingMode> {
        switch (attributionId.kind) {
            case "team":
                const team = await this.teamDB.findTeamById(attributionId.teamId);
                if (!team) {
                    throw new Error(`Cannot find team with id '${attributionId.teamId}'!`);
                }
                return this.getBillingModeForTeam(team, now);
            default:
                throw new Error("Invalid attributionId.");
        }
    }

    async getBillingModeForUser(user: User, now: Date): Promise<BillingMode> {
        if (!this.config.enablePayment) {
            // Payment is not enabled. E.g. Self-Hosted.
            return { mode: "none" };
        }

        // "paid" is not set here, just as before. Also, it's we should remove this whole method once the org-migration is done, and center all capabilities around Organizations
        return {
            mode: "usage-based",
        };
    }

    async getBillingModeForTeam(team: Team, _now: Date): Promise<BillingMode> {
        if (!this.config.enablePayment) {
            // Payment is not enabled. E.g. Dedicated
            return { mode: "none" };
        }

        const billingStrategy = await this.usageService.getCurrentBillingStategy(AttributionId.create(team));
        const paid = billingStrategy === CostCenter_BillingStrategy.BILLING_STRATEGY_STRIPE;
        return { mode: "usage-based", paid };
    }
}
