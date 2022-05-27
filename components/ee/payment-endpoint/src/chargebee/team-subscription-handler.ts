/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { inject, injectable } from "inversify";

import { TeamSubscriptionDB } from "@gitpod/gitpod-db/lib/team-subscription-db";
import { TeamSubscription2DB } from "@gitpod/gitpod-db/lib/team-subscription-2-db";
import { log, LogContext } from "@gitpod/gitpod-protocol/lib/util/logging";
import { Plans } from "@gitpod/gitpod-protocol/lib/plans";
import { TeamSubscription, TeamSubscription2 } from "@gitpod/gitpod-protocol/lib/team-subscription-protocol";
import { formatDate } from "@gitpod/gitpod-protocol/lib/util/date-time";
import { getCancelledAt, getStartDate } from "./chargebee-subscription-helper";
import { Chargebee as chargebee } from "./chargebee-types";
import { EventHandler } from "./chargebee-event-handler";
import { UpgradeHelper } from "./upgrade-helper";
import { TeamSubscriptionService } from "../accounting/team-subscription-service";
import { TeamSubscription2Service } from "../accounting/team-subscription2-service";
import { Config } from "../config";

@injectable()
export class TeamSubscriptionHandler implements EventHandler<chargebee.SubscriptionEventV2> {
    @inject(Config) protected readonly config: Config;
    @inject(TeamSubscriptionDB) protected readonly db: TeamSubscriptionDB;
    @inject(TeamSubscription2DB) protected readonly db2: TeamSubscription2DB;
    @inject(TeamSubscriptionService) protected readonly service: TeamSubscriptionService;
    @inject(TeamSubscription2Service) protected readonly service2: TeamSubscription2Service;
    @inject(UpgradeHelper) protected readonly upgradeHelper: UpgradeHelper;

    canHandle(event: chargebee.Event<any>): boolean {
        if (event.event_type.startsWith("subscription")) {
            const evt = event as chargebee.Event<chargebee.SubscriptionEventV2>;
            const plan = Plans.getById(evt.content.subscription.plan_id);
            if (!plan) {
                const msg = `Chargebee subscription event with invalid plan id: ${evt.content.subscription.plan_id}`;
                log.warn(this.userContext(evt), msg);
                throw new Error(msg);
            }
            return !!plan.team;
        }
        return false;
    }

    async handleSingleEvent(event: chargebee.Event<chargebee.SubscriptionEventV2>): Promise<boolean> {
        const chargebeeSubscription = event.content.subscription;
        const customerId = chargebeeSubscription.customer_id;
        const eventType = event.event_type;

        const logContext = this.userContext(event);
        log.info(logContext, `Start TeamSubscriptionHandler.handleSingleEvent`, { eventType });
        try {
            await this.mapToTeamSubscription(customerId, eventType, chargebeeSubscription);
        } catch (error) {
            log.error(logContext, "Error in TeamSubscriptionHandler.handleSingleEvent", error);
            throw error;
        }
        log.info(logContext, "Finished TeamSubscriptionHandler.handleSingleEvent", { eventType });
        return true;
    }

    async mapToTeamSubscription(
        customerId: string,
        eventType: chargebee.EventType,
        chargebeeSubscription: chargebee.Subscription,
    ) {
        if (customerId.startsWith("team:")) {
            const teamId = customerId.slice("team:".length);
            await this.mapToTeamSubscription2(teamId, eventType, chargebeeSubscription);
            return;
        }
        const userId = customerId;
        await this.db.transaction(async (db) => {
            const subs = await db.findTeamSubscriptions({
                userId,
                paymentReference: chargebeeSubscription.id,
            });
            if (subs.length === 0) {
                // Sanity check: If we try to create too many slots here we OOM, so we error instead.
                const quantity = chargebeeSubscription.plan_quantity;
                if (quantity > this.config.maxTeamSlotsOnCreation) {
                    throw new Error(
                        `(TS ${chargebeeSubscription.id}): nr of slots on creation (${quantity}) is higher than configured maximum (${this.config.maxTeamSlotsOnCreation}). Skipping creation!`,
                    );
                }

                const ts = TeamSubscription.create({
                    userId,
                    paymentReference: chargebeeSubscription.id,
                    planId: chargebeeSubscription.plan_id,
                    startDate: getStartDate(chargebeeSubscription),
                    endDate: chargebeeSubscription.cancelled_at ? getCancelledAt(chargebeeSubscription) : undefined,
                    quantity,
                    excludeFromMoreResources: true,
                });
                await db.storeTeamSubscriptionEntry(ts);
                await this.service.addSlots(ts, quantity);
            } else {
                const oldSubscription = subs.find((s) => s.paymentReference === chargebeeSubscription.id);
                if (!oldSubscription) {
                    throw new Error(`Cannot find TeamSubscription for paymentReference ${chargebeeSubscription.id}!`);
                }

                if (eventType === "subscription_cancelled") {
                    const cancelledAt = getCancelledAt(chargebeeSubscription);
                    oldSubscription.endDate = cancelledAt;
                    await this.service.deactivateAllSlots(oldSubscription, new Date(cancelledAt));
                }
                oldSubscription.quantity = chargebeeSubscription.plan_quantity;
                await db.storeTeamSubscriptionEntry(oldSubscription);
            }
        });
    }

    async mapToTeamSubscription2(
        teamId: string,
        eventType: chargebee.EventType,
        chargebeeSubscription: chargebee.Subscription,
    ) {
        await this.db2.transaction(async (db2) => {
            const sub = await db2.findByPaymentRef(teamId, chargebeeSubscription.id);
            if (!sub) {
                const ts2 = TeamSubscription2.create({
                    teamId,
                    paymentReference: chargebeeSubscription.id,
                    planId: chargebeeSubscription.plan_id,
                    quantity: chargebeeSubscription.plan_quantity,
                    startDate: getStartDate(chargebeeSubscription),
                    endDate: chargebeeSubscription.cancelled_at ? getCancelledAt(chargebeeSubscription) : undefined,
                });
                await db2.storeEntry(ts2);
                await this.service2.addAllTeamMemberSubscriptions(ts2);
            } else {
                if (eventType === "subscription_cancelled") {
                    const cancelledAt = getCancelledAt(chargebeeSubscription);
                    sub.endDate = cancelledAt;
                    await this.service2.cancelAllTeamMemberSubscriptions(sub, new Date(cancelledAt));
                } else if (chargebeeSubscription.plan_quantity > sub.quantity) {
                    // Upgrade: Charge for it!
                    const oldQuantity = sub.quantity;
                    const newQuantity = chargebeeSubscription.plan_quantity;
                    let pricePerUnitInCents = chargebeeSubscription.plan_unit_price;
                    if (pricePerUnitInCents === undefined) {
                        const plan = Plans.getById(sub.planId)!;
                        pricePerUnitInCents = plan.pricePerMonth * 100;
                    }
                    const currentTermRemainingRatio =
                        this.upgradeHelper.getCurrentTermRemainingRatio(chargebeeSubscription);
                    const diffInCents = Math.round(
                        pricePerUnitInCents * (newQuantity - oldQuantity) * currentTermRemainingRatio,
                    );
                    const upgradeTimestamp = new Date().toISOString();
                    const dateString = formatDate(upgradeTimestamp);
                    const description = `Pro-rated upgrade from ${oldQuantity} to ${newQuantity} team members (${dateString})`;
                    this.upgradeHelper
                        .chargeForUpgrade("", sub.paymentReference, diffInCents, description, upgradeTimestamp)
                        .catch((error) => {
                            log.error(`Could not charge for upgrade on TeamSubscription2 quantity increase!`, {
                                error,
                                ts2Id: sub.id,
                                chargebeeId: sub.paymentReference,
                                oldQuantity,
                                newQuantity,
                            });
                        });
                }
                sub.quantity = chargebeeSubscription.plan_quantity;
                await db2.storeEntry(sub);
            }
        });
    }

    protected userContext(event: chargebee.Event<chargebee.SubscriptionEventV2>): LogContext {
        return { userId: event.content.subscription.customer_id };
    }
}
