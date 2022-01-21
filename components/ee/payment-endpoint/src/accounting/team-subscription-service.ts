/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { injectable, inject } from 'inversify';
import { User } from '@gitpod/gitpod-protocol';
import {
  TeamSubscription,
  AssigneeIdentifier,
  TeamSubscriptionSlot,
  TeamSubscriptionSlotState,
  TeamSubscriptionSlotAssigned,
  TeamSubscriptionSlotDeactivated,
  TeamSubscriptionSlotResolved,
} from '@gitpod/gitpod-protocol/lib/team-subscription-protocol';
import {
  Subscription,
  AssignedTeamSubscription,
  CreditDescription,
} from '@gitpod/gitpod-protocol/lib/accounting-protocol';
import { TeamSubscriptionDB } from '@gitpod/gitpod-db/lib/team-subscription-db';
import { AccountingDB } from '@gitpod/gitpod-db/lib/accounting-db';
import { ABSOLUTE_MAX_USAGE, Plans } from '@gitpod/gitpod-protocol/lib/plans';
import { SubscriptionModel } from './subscription-model';
import { SubscriptionService } from './subscription-service';
import { AccountService } from './account-service';
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';

type TS = string | TeamSubscription;

@injectable()
export class TeamSubscriptionService {
  @inject(TeamSubscriptionDB) protected readonly db: TeamSubscriptionDB;
  @inject(AccountingDB) protected readonly accountingDb: AccountingDB;
  @inject(AccountService) protected readonly accountService: AccountService;
  @inject(SubscriptionService) protected readonly subscriptionService: SubscriptionService;

  /**
   * Adds new, free slots to the given TeamSubscription
   * @param teamSubscription
   * @param addQuantity
   */
  async addSlots(teamSubscription: TS, addQuantity: number) {
    const ts = await this.getTeamSubscription(teamSubscription);
    const promises = [];
    for (let i = 0; i < addQuantity; i++) {
      promises.push(this.db.storeSlot(TeamSubscriptionSlot.create({ teamSubscriptionId: ts.id })));
    }
    await Promise.all(promises);
    log.info({ userId: ts.userId }, 'Added slots to team subscription', { teamSubscription: ts, addQuantity });
  }

  /**
   * Deactivates all slots associated with the given TeamSubscription:
   *  - The user's subscription is cancelled immediately,
   *  - the slot is scheduled to be cancelled at current period end.
   *
   * @param teamSubscription
   * @param date When the slots should be cancelled
   */
  async deactivateAllSlots(teamSubscription: TS, date: Date) {
    const ts = await this.getTeamSubscription(teamSubscription);
    const slots = await this.db.findSlotsByTeamSubscriptionId(ts.id);

    // Don't use await Promise.all(slots.map(...)) here as for a high number of slots that hangs
    // at some point (maybe the connection/transaction is saturated somehow)
    // This may lead to endpoint timeouts (it's still slow), but that resolves on resend.
    for (const slot of slots) {
      const state = TeamSubscriptionSlot.status(slot, date.toISOString());
      switch (state) {
        case 'assigned':
        case 'unassigned':
          await this.deactivateSlot(ts, slot.id, date);

        default:
        case 'cancelled':
        case 'deactivated':
          continue;
      }
    }
    log.info({ userId: ts.userId }, 'Deactivated all team subscription slots', { teamSubscription: ts, date });
  }

  /**
   * Assigns the given slot to the assignee
   *
   * @param teamSubscription
   * @param slotId
   * @param assignee
   * @param assigneeIdentifier
   * @param date
   */
  async assignSlot(
    teamSubscription: TS,
    slotId: string,
    assignee: User,
    assigneeIdentifier: AssigneeIdentifier,
    date: Date,
  ) {
    return this.accountingDb.transaction(async (db) => {
      const now = date.toISOString();
      const ts = await this.getTeamSubscription(teamSubscription);
      const { startDate } = Subscription.calculateCurrentPeriod(ts.startDate, date);
      const { slot } = await this.loadSlot(slotId, ts.id, now, 'unassigned', 'deactivated');

      // Insert Subscription, starting with the current billing period of the TS
      const plan = Plans.getById(ts.planId)!;
      let subscription: Subscription;
      const state = TeamSubscriptionSlot.status(slot, now);
      switch (state) {
        case 'unassigned':
          subscription = await this.addSubscription(
            db,
            assignee.id,
            ts.planId,
            slot.id,
            startDate,
            Plans.getHoursPerMonth(plan),
          );
          break;
        case 'deactivated':
          // Add a new subscription, but it must end with the end of the current period.
          const endDate = slot.cancellationDate!;
          const cancelationDate = now;
          const remainingHoursThisPeriod = await this.calculateRemainingHoursThisPeriod(
            db,
            slot,
            startDate,
            now,
            Plans.getHoursPerMonth(plan),
          );
          subscription = await this.addSubscription(
            db,
            assignee.id,
            ts.planId,
            slot.id,
            startDate,
            Plans.getHoursPerMonth(plan),
            remainingHoursThisPeriod,
            endDate,
            cancelationDate,
          );
          break;
        default:
          throw Error('Unexpected slot state: ' + state);
      }

      // Update slot itself
      TeamSubscriptionSlot.assign(slot, assignee.id, subscription.uid, assigneeIdentifier);
      await this.db.storeSlot(slot);
      log.info({ userId: ts.userId }, 'Assigned team subscription slot', {
        teamSubscription: ts,
        slotId,
        assignee,
        date,
      });
    });
  }

  /**
   * Deactivates an already assigned slot:
   *  - The user's subscription is cancelled immediately,
   *  - the slot is scheduled to be cancelled at current period end.
   *
   * @param teamSubscription
   * @param slotId
   * @param date
   */
  async deactivateSlot(teamSubscription: TS, slotId: string, date: Date) {
    return this.accountingDb.transaction(async (db) => {
      const now = date.toISOString();
      const ts = await this.getTeamSubscription(teamSubscription);
      const { endDate } = Subscription.calculateCurrentPeriod(ts.startDate, date);
      const { slot, state } = await this.loadSlot(slotId, ts.id, now, 'assigned', 'unassigned');

      // Cancel assignee's subscription (if present)
      if (state === 'assigned') {
        const assignedSlot = slot as TeamSubscriptionSlotAssigned;
        await this.cancelSubscription(db, assignedSlot.assigneeId, ts.planId, slot.id, now);
      }

      // Update slot: Deactivate effective on term end
      TeamSubscriptionSlot.deactivate(slot, endDate);
      await this.db.storeSlot(slot);
      log.info({ userId: ts.userId }, 'Deactivated team subscription slot', { teamSubscription: ts, slotId, date });
    });
  }

  /**
   * Reactivates a previously deactivated slot:
   *  - The user's get a fresh subscription
   *  - the slot's cancellation is descheduled
   *
   * @param teamSubscription
   * @param slotId
   * @param date
   */
  async reactivateSlot(teamSubscription: TS, slotId: string, date: Date) {
    return this.accountingDb.transaction(async (db) => {
      const now = date.toISOString();
      const ts = await this.getTeamSubscription(teamSubscription);
      const { startDate } = Subscription.calculateCurrentPeriod(ts.startDate, date);
      const slot = (await this.loadSlot(slotId, ts.id, now, 'deactivated')).slot as TeamSubscriptionSlotDeactivated;

      // Re-Create assignee's subscription
      if (slot.assigneeId) {
        const plan = Plans.getById(ts.planId)!;
        const subscription = await this.addSubscription(
          db,
          slot.assigneeId,
          ts.planId,
          slot.id,
          startDate,
          Plans.getHoursPerMonth(plan),
        );

        // Update slot
        TeamSubscriptionSlot.reactivate(slot, subscription.uid);
      } else {
        // Update slot
        TeamSubscriptionSlot.reactivate(slot);
      }

      await this.db.storeSlot(slot);
      log.info({ userId: ts.userId }, 'Reactivated team subscription slot', { teamSubscription: ts, slotId, date });
    });
  }

  /**
   * Assigns the given slot to a new assignee
   *
   * @param teamSubscription
   * @param slotId
   * @param newAssignee
   * @param newAssigneeIdentifier
   * @param date
   */
  async reassignSlot(
    teamSubscription: TS,
    slotId: string,
    newAssignee: User,
    newAssigneeIdentifier: AssigneeIdentifier,
    date: Date,
  ) {
    return this.accountingDb.transaction(async (db) => {
      const now = date.toISOString();
      const ts = await this.getTeamSubscription(teamSubscription);
      const { startDate } = Subscription.calculateCurrentPeriod(ts.startDate, date);
      const slot = (await this.loadSlot(slotId, ts.id, now, 'assigned')).slot as TeamSubscriptionSlotAssigned;

      // Cancel old assignees subscription
      await this.cancelSubscription(db, slot.assigneeId, ts.planId, slot.id, now);

      // Create new assignee's subscription
      const plan = Plans.getById(ts.planId)!;
      const remainingHoursThisPeriod = await this.calculateRemainingHoursThisPeriod(
        db,
        slot,
        startDate,
        now,
        Plans.getHoursPerMonth(plan),
      );
      const newSubscription = await this.addSubscription(
        db,
        newAssignee.id,
        ts.planId,
        slot.id,
        startDate,
        Plans.getHoursPerMonth(plan),
        remainingHoursThisPeriod,
      );

      // Update slot
      TeamSubscriptionSlot.assign(slot, newAssignee.id, newSubscription.uid, newAssigneeIdentifier);
      await this.db.storeSlot(slot);
      log.info({ userId: ts.userId }, 'Reassigned team subscription slot', {
        teamSubscription: ts,
        slotId,
        newAssignee,
        date,
      });
    });
  }

  protected async calculateRemainingHoursThisPeriod(
    db: AccountingDB,
    slot: TeamSubscriptionSlot,
    currentPeriodStartDate: string,
    now: string,
    hoursPerMonth: number,
  ) {
    const oldSlotSubscriptionsActiveThisPeriod = (await db.findSubscriptionsByTeamSubscriptionSlotId(slot.id)).filter(
      (ts) => Subscription.isActive(ts, currentPeriodStartDate),
    );
    if (oldSlotSubscriptionsActiveThisPeriod.some((s) => Plans.getById(s.planId)?.hoursPerMonth === 'unlimited')) {
      return ABSOLUTE_MAX_USAGE;
    }
    const userMap = this.groupByUser(oldSlotSubscriptionsActiveThisPeriod);
    const calcTotalUsage = async (subscriptions: Subscription[], userId: string) => {
      const statement = await this.accountService.getAccountStatement(userId, now);
      return (
        statement.credits
          // Find all credits resulting from the subscriptions above
          .filter(
            (c) =>
              CreditDescription.is(c.description) &&
              subscriptions.some((s) => s.uid === (c.description as CreditDescription).subscriptionId),
          )
          // Cumulate usage (total - remaining)
          .reduce((cum, e) => (!e.remainingAmount ? cum : cum + (e.amount - e.remainingAmount)), 0)
      );
    };

    const totalUsagesPerUser: Promise<number>[] = [];
    userMap.forEach((subscriptions, userId) => {
      totalUsagesPerUser.push(calcTotalUsage(subscriptions, userId));
    });

    const totalUsage = (await Promise.all(totalUsagesPerUser)).reduce((prev, cur) => prev + cur, 0);
    const usageHoursThisPeriod = Math.max(0, totalUsage);
    return Math.max(0, hoursPerMonth - usageHoursThisPeriod);
  }

  protected groupByUser(subscriptions: Subscription[]): Map<string, Subscription[]> {
    const userMap = new Map<string, Subscription[]>();
    subscriptions.forEach((s) => {
      let entry = userMap.get(s.userId);
      if (!entry) {
        entry = [];
        userMap.set(s.userId, entry);
      }
      entry.push(s);
    });
    return userMap;
  }

  /**
   * Returns all TeamSubscriptions and resulting Subscriptions for a given user
   * @param assignerUserId
   * @param date
   */
  async findTeamSubscriptionSlotsBy(assignerUserId: string, date: Date): Promise<TeamSubscriptionSlotResolved[]> {
    const tss = await this.db.findTeamSubscriptionsForUser(assignerUserId, date.toISOString());
    const mapToSubscriptions = tss.map((ts) => this.findAssignedSubscriptionsBy(ts, date));
    const assignedSubscriptions = await Promise.all(mapToSubscriptions);
    return flatten(assignedSubscriptions);
  }

  /**
   * Returns all active and unassigned slots for an active team subscription
   */
  async findUnassignedSlots(teamSubscriptionId: string): Promise<TeamSubscriptionSlot[]> {
    const now = new Date().toISOString();
    const ts = await this.getTeamSubscription(teamSubscriptionId);
    if (ts.deleted || (!!ts.cancellationDate && ts.cancellationDate < now)) {
      return [];
    }
    return (await this.db.findSlotsByTeamSubscriptionId(teamSubscriptionId)).filter(
      (s) => TeamSubscriptionSlot.status(s, now) === 'unassigned',
    );
  }

  protected async findAssignedSubscriptionsBy(teamSubscription: TeamSubscription, date: Date) {
    const dateStr = date.toISOString();
    const slots = await this.db.findSlotsByTeamSubscriptionId(teamSubscription.id);
    const { startDate } = Subscription.calculateCurrentPeriod(teamSubscription.startDate, date);
    const plan = Plans.getById(teamSubscription.planId);
    if (!plan) {
      return [];
    }
    return Promise.all(
      slots.map(async (s) => {
        const subscription = s.subscriptionId
          ? await this.accountingDb.findSubscriptionById(s.subscriptionId)
          : undefined;
        const remainingHoursThisPeriod = await this.calculateRemainingHoursThisPeriod(
          this.accountingDb,
          s,
          startDate,
          dateStr,
          Plans.getHoursPerMonth(plan),
        );
        const tssr: TeamSubscriptionSlotResolved = {
          id: s.id,
          teamSubscription,
          state: TeamSubscriptionSlot.status(s, dateStr),
          assigneeId: s.assigneeId,
          assigneeIdentifier: s.assigneeIdentifier,
          subscription,
          cancellationDate: s.cancellationDate,
          hoursLeft: remainingHoursThisPeriod,
        };
        return tssr;
      }),
    );
  }

  protected async getTeamSubscription(ts: TS): Promise<TeamSubscription> {
    if (typeof ts === 'string') {
      const realTs = await this.db.findTeamSubscriptionById(ts);
      if (!realTs) {
        throw new Error(`No Team Subscription found for id ${ts}!`);
      }
      return realTs;
    } else {
      return ts;
    }
  }

  protected async loadSlot(
    id: string,
    tsId: string,
    now: string,
    ...expectedStates: TeamSubscriptionSlotState[]
  ): Promise<{ slot: TeamSubscriptionSlot; state: TeamSubscriptionSlotState }> {
    const slot = await this.db.findSlotById(id);
    if (!slot) {
      throw new Error(`No Team Subscription slot for id: ${id}!`);
    }
    if (slot.teamSubscriptionId !== tsId) {
      throw new Error(`Team Subscription id ${tsId} does not match slot id: ${id}!`);
    }
    const actualState = TeamSubscriptionSlot.status(slot, now);
    if (!expectedStates.some((s) => s === actualState)) {
      throw new Error(`Expected Team Subscription Slot to be in state ${expectedStates} but was in ${actualState}!`);
    }
    return { slot, state: actualState };
  }

  protected async cancelSubscription(
    db: AccountingDB,
    assigneeId: string,
    planId: string,
    slotId: string,
    cancellationDate: string,
  ) {
    const model = await this.loadSubscriptionModel(db, assigneeId);
    const subscription = model.findSubscriptionByTeamSubscriptionSlotId(slotId);
    if (!subscription) {
      throw new Error(`Cannot find subscription for Team Subscription Slot ${slotId}!`);
    }
    model.cancel(subscription, cancellationDate, cancellationDate);
    await this.subscriptionService.store(db, model);
  }

  protected async addSubscription(
    db: AccountingDB,
    assigneeId: string,
    planId: string,
    slotId: string,
    startDate: string,
    amount: number,
    firstMonthAmount?: number,
    endDate?: string,
    cancelationDate?: string,
  ) {
    const model = await this.loadSubscriptionModel(db, assigneeId);
    const subscription = Subscription.create({
      userId: assigneeId,
      planId: planId,
      amount,
      startDate,
      endDate,
      cancellationDate: cancelationDate || endDate,
      teamSubscriptionSlotId: slotId,
      firstMonthAmount,
    });
    model.add(subscription);
    await this.subscriptionService.store(db, model);
    return subscription;
  }

  protected async loadSubscriptionModel(db: AccountingDB, userId: string) {
    const subscriptions = await db.findAllSubscriptionsForUser(userId);
    const subscriptionsFromTS = subscriptions.filter((s) => AssignedTeamSubscription.is(s));
    return new SubscriptionModel(userId, subscriptionsFromTS);
  }

  async findTeamSubscriptionSlotsByAssignee(assigneeId: string): Promise<TeamSubscriptionSlot[]> {
    return this.db.findSlotsByAssignee(assigneeId);
  }
}

const flatten = <T>(input: T[][]): T[] => {
  const result: T[] = [];
  for (const arr of input) {
    for (const t of arr) {
      result.push(t);
    }
  }
  return result;
};
