/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { TypeORM } from "@gitpod/gitpod-db/lib";
import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { inject, injectable } from "inversify";
import { StripeService } from "../user/stripe-service";
import { Job } from "./runner";
import { Config } from "../config";

@injectable()
export class FixStripeAttributionIds implements Job {
    @inject(TypeORM) protected readonly typeorm: TypeORM;
    @inject(StripeService) protected readonly stripeService: StripeService;
    @inject(Config) protected readonly config: Config;

    public readonly name = "fix-stripe-attribution-ids";
    public readonly lockId = [this.name];
    public frequencyMs = 300 * 60 * 1000; // every 5 hours

    public async run(): Promise<void> {
        if (!this.config.stripeSecrets) {
            log.info("Job disabled", { name: this.name, reason: "stripeSecrets not configured" });
            return;
        }
        try {
            const c = await this.typeorm.getConnection();
            const result = await c.query(`
                SELECT
                    c.stripeCustomerid, o.id as organizationId, u.id as userId
                FROM
                    d_b_stripe_customer c, d_b_team o, d_b_team_membership m, d_b_user u
                WHERE
                    o.id = m.teamId AND
                    m.userId = u.id AND
                    (o.name = u.name OR o.name = u.fullName) AND
                    u._lastModified >'2023-04-15' AND
                    c.deleted = 0 AND
                    u.additionalData->>'$.isMigratedToTeamOnlyAttribution' = 'true' AND
                    SUBSTRING(c.attributionId,6) = o.id
            `);
            log.info(`Starting update for stripe customer ids`, { numberOfCustomers: result.length });
            let migrated = 0;
            // iterate over result set and update the attributionid stripe attributionid
            for (const row of result) {
                const userId = row.userId;
                const organizationId = row.organizationId;
                const stripeCustomerId = row.stripeCustomerid;
                if (
                    await this.stripeService.updateAttributionId(
                        stripeCustomerId,
                        AttributionId.render({ kind: "team", teamId: organizationId }),
                        AttributionId.render({ kind: "user", userId: userId }),
                    )
                ) {
                    migrated++;
                }
                // wait a bit to not overload the stripe API
                await new Promise((r) => setTimeout(r, 1000));
            }

            log.info(`Finished update for stripe customer ids`, { numberOfCustomers: result.length, migrated });
        } catch (err) {
            log.error("Failed to run job", err, { jobName: this.name });
            throw err;
        }
    }
}
