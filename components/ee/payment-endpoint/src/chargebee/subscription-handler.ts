/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { inject, injectable } from 'inversify';

import { SubscriptionService } from '../accounting/subscription-service';
import { AccountingDB } from '@gitpod/gitpod-db/lib/accounting-db';
import { log, LogContext } from '@gitpod/gitpod-protocol/lib/util/logging';
import { SubscriptionMapperFactory } from './subscription-mapper';
import { Plans } from '@gitpod/gitpod-protocol/lib/plans';
import { Chargebee as chargebee } from './chargebee-types';
import { EventHandler } from './chargebee-event-handler';
import { UpgradeHelper } from './upgrade-helper';
import { formatDate } from '@gitpod/gitpod-protocol/lib/util/date-time';
import { getUpdatedAt } from './chargebee-subscription-helper';
import { UserPaidSubscription } from '@gitpod/gitpod-protocol/lib/accounting-protocol';
import { DBSubscriptionAdditionalData } from '@gitpod/gitpod-db/lib/typeorm/entity/db-subscription';

@injectable()
export class SubscriptionHandler implements EventHandler<chargebee.SubscriptionEventV2> {
  @inject(SubscriptionService) protected readonly subscriptionService: SubscriptionService;
  @inject(AccountingDB) protected readonly db: AccountingDB;
  @inject(SubscriptionMapperFactory) protected readonly mapperFactory: SubscriptionMapperFactory;
  @inject(UpgradeHelper) protected readonly upgradeHelper: UpgradeHelper;

  canHandle(event: chargebee.Event<any>): boolean {
    if (event.event_type.startsWith('subscription')) {
      const evt = event as chargebee.Event<chargebee.SubscriptionEventV2>;
      const plan = Plans.getById(evt.content.subscription.plan_id);
      return !!plan && !plan.team;
    }
    return false;
  }

  async handleSingleEvent(event: chargebee.Event<chargebee.SubscriptionEventV2>): Promise<boolean> {
    const chargebeeSubscription = event.content.subscription;
    const userId = chargebeeSubscription.customer_id;
    const eventType = event.event_type;

    const logContext: LogContext = { userId };
    log.debug(logContext, `Start SubscriptionHandler.handleSingleEvent`, { eventType });
    try {
      if (!event.content.subscription) {
        log.error(logContext, 'Ignoring event, because it does not contain a subscription', event);
      } else {
        try {
          await this.storeAdditionalData(event.content.subscription, event.content.invoice);
        } catch (err) {
          log.error(logContext, 'Failed to store additional subscription data', event);
        }
      }

      if (event.event_type === 'subscription_changed') {
        await this.checkAndChargeForUpgrade(userId, chargebeeSubscription);
      }

      await this.mapToGitpodSubscription(userId, event);
    } catch (error) {
      log.error(logContext, 'Error in SubscriptionHandler.handleSingleEvent', error);
      throw error;
    }
    log.debug(logContext, 'Finished SubscriptionHandler.handleSingleEvent', { eventType });
    return true;
  }

  async storeAdditionalData(subscription: chargebee.Subscription, invoice?: chargebee.Invoice): Promise<void> {
    const paymentReference = subscription.id;
    const coupons = subscription.coupons;
    const mrr = subscription.mrr || 0;
    const nextBilling =
      (subscription.next_billing_at && new Date(subscription.next_billing_at * 1000).toISOString()) || '';
    let lastInvoice = '';
    let lastInvoiceAmount: number = 0;
    if (invoice) {
      lastInvoice = (invoice.date && new Date(invoice.date * 1000).toISOString()) || '';
      lastInvoiceAmount = invoice.total || 0;
    }

    const data: DBSubscriptionAdditionalData = {
      paymentReference,
      coupons,
      mrr,
      lastInvoice,
      lastInvoiceAmount,
      nextBilling,
    };
    await this.db.storeSubscriptionAdditionalData(data);
  }

  /**
   * As we allow immediate Upgrades (say, 'Basic' -> 'Professional'), we have to manually apply charges here, because
   * Chargebee does not support this out of the box. Downgrades are delayed until the end of the current period and
   * thus not relevant here.
   *
   * @param userId
   * @param chargebeeSubscription
   */
  protected async checkAndChargeForUpgrade(userId: string, chargebeeSubscription: chargebee.Subscription) {
    const gitpodSubscriptions = await this.db.findSubscriptionForUserByPaymentRef(userId, chargebeeSubscription.id);
    if (gitpodSubscriptions.length === 0) {
      throw new Error(
        `Expected existing Gitpod subscription for PaymentRef ${chargebeeSubscription.id} and user ${userId}, found none.`,
      );
    }
    const currentGitpodSubscription = gitpodSubscriptions[0]; // Ordered by startDate DESC
    const oldPlan = Plans.getById(currentGitpodSubscription.planId)!;
    const newPlan = Plans.getById(chargebeeSubscription.plan_id)!;

    if (newPlan.pricePerMonth > oldPlan.pricePerMonth) {
      // Upgrade: Charge for it!
      const diffInCents = newPlan.pricePerMonth * 100 - oldPlan.pricePerMonth * 100;
      const upgradeTimestamp = getUpdatedAt(chargebeeSubscription);
      const description = `Difference on Upgrade from '${oldPlan.name}' to '${newPlan.name}' (${formatDate(
        upgradeTimestamp,
      )})`;
      await this.upgradeHelper.chargeForUpgrade(
        userId,
        chargebeeSubscription.id,
        diffInCents,
        description,
        upgradeTimestamp,
      );
    }
  }

  /**
   * Loads all relvant data from DB, calculates diff and applies that afterwards
   * @param userId
   * @param event
   */
  protected async mapToGitpodSubscription(userId: string, event: chargebee.Event<chargebee.SubscriptionEventV2>) {
    await this.db.transaction(async (db) => {
      const subscriptions = await db.findAllSubscriptionsForUser(userId);
      const userPaidSubscriptions = subscriptions.filter((s) => UserPaidSubscription.is(s));

      const mapper = this.mapperFactory.newMapper();
      const delta = mapper.map(userPaidSubscriptions, event).getResult();

      await Promise.all([
        ...delta.updates.map((s) => db.storeSubscription(s)),
        ...delta.inserts.map((s) => db.newSubscription(s)),
      ]);
    });
  }

  // TODO
  handleEvents(events: chargebee.Event<chargebee.SubscriptionEventV2>[], startDate: Date) {
    // 1. Select Gitpod subscriptions that existed before
    // 2. Fetch Chargebee events since startDate, ordered by resource_version from API
    // 3. Apply all events to handleSingleEvent
    // 4. Compare result with the one from the API
  }
}
