/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { Plans } from '@gitpod/gitpod-protocol/lib/plans';
import { orderByEndDateDescThenStartDateDesc } from '../accounting/accounting-util';
import { Subscription } from '@gitpod/gitpod-protocol/lib/accounting-protocol';
import { oneMonthLater, secondsBefore } from '@gitpod/gitpod-protocol/lib/util/timeutil';
import { Chargebee as chargebee } from './/chargebee-types';

import { getStartDate, getCancelledAt, getUpdatedAt } from './chargebee-subscription-helper';
import { SubscriptionModel } from '../accounting/subscription-model';
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';

/**
 * This class updates our internal Gitpod Subscription model with the events coming from the payment provider Chargebee
 * where our customers manage their plans.
 * This implementation heavily depends on the Chargebee configuration as event cycles, timings and content differ widly
 * between configurations. Currently Chargebee is configured to:
 * - allow at most one plan at a time
 * - not know the Free Gitpod Subscription
 * - allow upgrades any time: effective immediately (does not change period start/end)
 * - allow to downgrade any time: effective next billing period
 * - allow reactivation of cancelled subscriptions (creates new billing period starting at the time of reactivation)
 *
 * Interesting implementation details:
 * - due to reactivation, there might exist several Gitpod subscriptions with the same payment reference
 *
 * Thus we have to consider 4 operations:
 * - create
 * - update (Upgrade/Downgrade)
 * - cancel
 * - reactivate
 *
 * @see AccountingProtocol
 */
export class SubscriptionMapper {
  protected model: SubscriptionModel;

  /**
   * @see SubscriptionMapper
   * @param gitpodSubscriptions
   * @param chargebeeEvent
   */
  map(
    gitpodSubscriptions: Subscription[],
    chargebeeEvent: chargebee.Event<chargebee.SubscriptionEventV2>,
  ): SubscriptionModel {
    const eventType = chargebeeEvent.event_type;
    const chargebeeSubscription = chargebeeEvent.content.subscription;

    this.model = new SubscriptionModel(
      chargebeeSubscription.customer_id,
      gitpodSubscriptions.sort(orderByEndDateDescThenStartDateDesc),
    );
    switch (eventType) {
      case 'subscription_created':
        this.handleSubscriptionCreated(chargebeeSubscription);
        break;
      case 'subscription_changed':
        this.handleSubscriptionChanged(chargebeeSubscription);
        break;
      case 'subscription_cancelled':
        this.handleSubscriptionCancelled(chargebeeSubscription);
        break;
      case 'subscription_reactivated':
        this.handleSubscriptionReactivated(chargebeeSubscription);
        break;
      case 'subscription_changes_scheduled':
        this.handleSubscriptionChangesScheduled(chargebeeSubscription);
        break;
      case 'subscription_scheduled_changes_removed':
        this.handleSubscriptionScheduledChangesRemoved(chargebeeSubscription);
        break;
      default:
    }
    return this.model;
  }

  /**
   * Chargebee subscription created: create new Gitpod subscription
   *
   * @param chargebeeSubscription
   */
  protected handleSubscriptionCreated(chargebeeSubscription: chargebee.Subscription) {
    this.model.add(
      Subscription.create({
        userId: chargebeeSubscription.customer_id,
        startDate: getStartDate(chargebeeSubscription),
        planId: chargebeeSubscription.plan_id,
        amount: Plans.getHoursPerMonth(getPlan(chargebeeSubscription)),
        paymentReference: chargebeeSubscription.id,
      }),
    );
  }

  /**
   * Chargebee subscription changed: Detect whether it's a down- or upgrade:
   * - Upgrade:
   *   - update Gitpod subscription with new amount
   * - Downgrade:
   *   - terminate the old Gitpod subscription to end of current billing period
   *   - create a new Gitpod subscription for the downgrade
   *
   * @param gitpodSubscriptions
   * @param chargebeeSubscription
   */
  protected handleSubscriptionChanged(chargebeeSubscription: chargebee.Subscription) {
    // Find old Gitpod subscription for the incoming, updated Chargebee Subscription
    const oldSubscription = this.model.findSubscriptionByPaymentReference(chargebeeSubscription.id);
    const chargebeePlan = getPlan(chargebeeSubscription);
    const newAmount = Plans.getHoursPerMonth(chargebeePlan);
    const oldPlan = Plans.getById(oldSubscription.planId);
    if (!oldPlan) {
      throw new Error(`Unknown plan id (data inconsistency): '${oldSubscription.planId}'`);
    }

    const subscriptionChange = Plans.subscriptionChange(oldPlan.type, chargebeePlan.type);
    if (subscriptionChange === 'downgrade') {
      // Downgrade
      // 1. Calculate end of current billing period and end oldSubscription there
      // Determine the current period, when it will end and end it
      let dateInLastPeriod: Date;
      if (oldSubscription.paymentData && oldSubscription.paymentData.downgradeDate) {
        // Downgrade is set, now make sure we will actually land in the period before, not the next (downgradeDate has seconds precision)
        dateInLastPeriod = new Date(secondsBefore(oldSubscription.paymentData.downgradeDate, 1));
      } else {
        // This is left in place as mere fallback in case of bad legacy data in the DB, it should never be triggered
        log.warn('Downgrade without downgradeDate!');
        dateInLastPeriod = new Date();
      }
      const { endDate: oldEndDate } = Subscription.calculateCurrentPeriod(oldSubscription.startDate, dateInLastPeriod);
      this.model.cancel(oldSubscription, oldEndDate, oldEndDate);

      // 2. Create new Gitpod subscription with same paymentReference but new billing period
      this.model.add(
        Subscription.create({
          userId: chargebeeSubscription.customer_id,
          startDate: oldEndDate,
          planId: chargebeeSubscription.plan_id,
          amount: newAmount,
          paymentReference: chargebeeSubscription.id,
        }),
      );
    } else if (subscriptionChange === 'upgrade') {
      // Upgrade
      oldSubscription.amount = newAmount;
      oldSubscription.planId = chargebeeSubscription.plan_id;
      this.model.update(oldSubscription);
    } else {
      // As of now we're not interested in other updates
    }
  }

  /**
   * - Chargebee subscription cancelled:
   *   - terminate the Gitpod subscription to the end of current billing period because we want the user to retain the credits he already paid for
   *     We calculate it to one month after current billing period started because the Chargebee Subscription does not carry any information about this
   *
   * @param chargebeeSubscription
   */
  protected handleSubscriptionCancelled(chargebeeSubscription: chargebee.Subscription) {
    const gitpodSubscription = this.model.findSubscriptionByPaymentReference(chargebeeSubscription.id);
    const cancellationDate = getCancelledAt(chargebeeSubscription);

    const endDate = calculateCurrentTermEnd(gitpodSubscription.startDate, cancellationDate);
    this.model.cancel(gitpodSubscription, cancellationDate, endDate);
  }

  /**
   * - Chargebee subscription reactivated:
   *   - create a new Gitpod subscription for the Chargebee subscription
   *
   * @param chargebeeSubscription
   */
  protected handleSubscriptionReactivated(chargebeeSubscription: chargebee.Subscription) {
    this.model.add(
      Subscription.create({
        userId: chargebeeSubscription.customer_id,
        startDate: getStartDate(chargebeeSubscription),
        planId: chargebeeSubscription.plan_id,
        amount: Plans.getHoursPerMonth(getPlan(chargebeeSubscription)),
        paymentReference: chargebeeSubscription.id,
      }),
    );
  }

  /**
   * - Chargebee subcription has scheduled changes: Only appear during downgrades
   *
   * @param chargebeeSubscription
   */
  protected handleSubscriptionChangesScheduled(chargebeeSubscription: chargebee.Subscription) {
    const gitpodSubscription = this.model.findSubscriptionByPaymentReference(chargebeeSubscription.id);
    const { endDate: downgradeEffectiveDate } = Subscription.calculateCurrentPeriod(
      gitpodSubscription.startDate,
      new Date(getUpdatedAt(chargebeeSubscription)),
    );
    if (gitpodSubscription.paymentData) {
      gitpodSubscription.paymentData.downgradeDate = downgradeEffectiveDate;
    } else {
      gitpodSubscription.paymentData = { downgradeDate: downgradeEffectiveDate };
    }
    this.model.update(gitpodSubscription);
  }

  /**
   * - A Chargebee subcription's scheduled changes were removed: A downgrade has been reverted
   *
   * @param chargebeeSubscription
   */
  protected handleSubscriptionScheduledChangesRemoved(chargebeeSubscription: chargebee.Subscription) {
    const gitpodSubscription = this.model.findSubscriptionByPaymentReference(chargebeeSubscription.id);
    if (gitpodSubscription.paymentData) {
      gitpodSubscription.paymentData.downgradeDate = undefined;
      this.model.update(gitpodSubscription);
    }
  }
}

/**
 * Calculates the end of the current term by starting from startDate and incrementing months until it is newer than upToDate
 *
 * @param startDate
 * @param upToDate
 */
const calculateCurrentTermEnd = (startDate: string, upTo: string): string => {
  const termStartDate = new Date(startDate);
  const upToDate = new Date(upTo);
  if (termStartDate.getTime() >= upToDate.getTime()) {
    throw new Error(
      `calculateCurrentTermEnd: termStart (${termStartDate}) must be less than potential term end (${upToDate.getTime()})`,
    );
  }
  const dayOfMonth = termStartDate.getDate();
  let potentialCurrentTermEnd = termStartDate;
  while (potentialCurrentTermEnd.getTime() < upToDate.getTime()) {
    potentialCurrentTermEnd = new Date(oneMonthLater(potentialCurrentTermEnd.toISOString(), dayOfMonth));
  }
  return potentialCurrentTermEnd.toISOString();
};

const getPlan = (chargebeeSubscription: chargebee.Subscription) => {
  const plan = Plans.getById(chargebeeSubscription.plan_id);
  if (!plan) {
    throw new Error(`Cannot find Gitpod plan for id: ${chargebeeSubscription.plan_id}`);
  }
  return plan;
};

export const SubscriptionMapperFactory = Symbol('SubscriptionMapperFactory');
export interface SubscriptionMapperFactory {
  newMapper(): SubscriptionMapper;
}
