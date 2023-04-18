/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { injectable, inject } from "inversify";
import { UserDeletionService } from "../../../src/user/user-deletion-service";
import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";
import { StripeService } from "./stripe-service";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";

@injectable()
export class UserDeletionServiceEE extends UserDeletionService {
    @inject(StripeService) protected readonly stripeService: StripeService;

    async deleteUser(id: string): Promise<void> {
        const user = await this.db.findUserById(id);
        if (!user) {
            throw new Error(`No user with id ${id} found!`);
        }

        const errors = [];
        if (this.config.enablePayment) {
            let subscriptionId;
            try {
                // Also cancel any usage-based (Stripe) subscription
                subscriptionId = await this.stripeService.findUncancelledSubscriptionByAttributionId(
                    AttributionId.render({ kind: "user", userId: user.id }),
                );
                if (subscriptionId) {
                    await this.stripeService.cancelSubscription(subscriptionId);
                }
            } catch (error) {
                errors.push(error);
                log.error("Error cancelling Stripe user subscription", error, { subscriptionId });
            }
        }

        if (errors.length > 0) {
            throw new Error(errors.join("\n"));
        }
        await super.deleteUser(id);
    }
}
