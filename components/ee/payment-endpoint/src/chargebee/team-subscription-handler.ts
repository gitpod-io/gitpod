/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { inject, injectable } from 'inversify';

import { TeamSubscriptionDB } from '@gitpod/gitpod-db/lib/team-subscription-db';
import { log, LogContext } from '@gitpod/gitpod-protocol/lib/util/logging';
import { Plans } from '@gitpod/gitpod-protocol/lib/plans';
import { TeamSubscription } from '@gitpod/gitpod-protocol/lib/team-subscription-protocol';
import { getCancelledAt, getStartDate } from './chargebee-subscription-helper';
import { Chargebee as chargebee } from './chargebee-types';
import { EventHandler } from './chargebee-event-handler';
import { TeamSubscriptionService } from '../accounting/team-subscription-service';
import { Config } from '../config';

@injectable()
export class TeamSubscriptionHandler implements EventHandler<chargebee.SubscriptionEventV2> {
    @inject(Config) protected readonly config: Config;
    @inject(TeamSubscriptionDB) protected readonly db: TeamSubscriptionDB;
    @inject(TeamSubscriptionService) protected readonly service: TeamSubscriptionService;

    canHandle(event: chargebee.Event<any>): boolean {
        if (event.event_type.startsWith('subscription')) {
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
        const userId = chargebeeSubscription.customer_id;
        const eventType = event.event_type;

        const logContext = this.userContext(event);
        log.info(logContext, `Start TeamSubscriptionHandler.handleSingleEvent`, { eventType });
        try {
            await this.mapToTeamSubscription(userId, eventType, chargebeeSubscription);
        } catch (error) {
            log.error(logContext, 'Error in TeamSubscriptionHandler.handleSingleEvent', error);
            throw error;
        }
        log.info(logContext, 'Finished TeamSubscriptionHandler.handleSingleEvent', { eventType });
        return true;
    }

    async mapToTeamSubscription(
        userId: string,
        eventType: chargebee.EventType,
        chargebeeSubscription: chargebee.Subscription,
    ) {
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
                });
                await db.storeTeamSubscriptionEntry(ts);
                await this.service.addSlots(ts, quantity);
            } else {
                const oldSubscription = subs.find((s) => s.paymentReference === chargebeeSubscription.id);
                if (!oldSubscription) {
                    throw new Error(`Cannot find TeamSubscription for paymentReference ${chargebeeSubscription.id}!`);
                }

                if (eventType === 'subscription_cancelled') {
                    const cancelledAt = getCancelledAt(chargebeeSubscription);
                    oldSubscription.endDate = cancelledAt;
                    await this.service.deactivateAllSlots(oldSubscription, new Date(cancelledAt));
                }
                oldSubscription.quantity = chargebeeSubscription.plan_quantity;
                await db.storeTeamSubscriptionEntry(oldSubscription);
            }
        });
    }

    protected userContext(event: chargebee.Event<chargebee.SubscriptionEventV2>): LogContext {
        return { userId: event.content.subscription.customer_id };
    }
}
