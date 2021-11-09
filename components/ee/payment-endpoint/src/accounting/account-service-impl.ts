/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { inject, injectable } from "inversify";

import { AccountingDB } from "@gitpod/gitpod-db/lib/accounting-db";
import { UserDB, WorkspaceDB, WorkspaceInstanceSessionWithWorkspace } from '@gitpod/gitpod-db/lib';
import { hoursToMilliseconds, millisecondsToHours, oneMonthLater, rightBefore, oldest, earliest, durationInHours, isDateSmallerOrEqual, durationInMillis, addMillis } from "@gitpod/gitpod-protocol/lib/util/timeutil";
import { AccountEntry, Subscription, AccountStatement, AccountEntryFixedPeriod, SessionDescription, CreditDescription, Debit, DebitAccountEntryKind, Credit, LossDebit } from "@gitpod/gitpod-protocol/lib/accounting-protocol";
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';

import { Accounting } from "./accounting";
import { orderByExpiryDateDesc, SortedArray, orderCreditFirst, within } from "./accounting-util";
import { AccountService } from "./account-service";
import { SubscriptionService } from "./subscription-service";
import { Plans } from "@gitpod/gitpod-protocol/lib/plans";

/**
 * There are some things to do/check which are not vital right now:
 * TODOS:
 *  - persistence:
 *    - add references to credits to identify them across account statements
 *    - with that, load subscription/package that started during last statement and ends in current (remainingAmount!)
 *  - protocol between statement:
 *    - is AccountStatement.endDate exclusive or inclusive? Review code around statement boundaries corners, add tests!
 *  - !Switch from amounts in hours to seconds for avoiding rounding errors, string/hours/milliseconds conversions!
 */
@injectable()
export class AccountServiceImpl implements AccountService {
    @inject(UserDB) protected readonly userDB: UserDB;
    @inject(AccountingDB) protected readonly accountingDB: AccountingDB;
    @inject(SubscriptionService) protected readonly subscriptionService: SubscriptionService;
    @inject(WorkspaceDB) protected readonly workspaceDB: WorkspaceDB;

    /**
     * We're trying to calculate when f"our credits" - f"Usage" will hit zero.
     * The implementation is based around the idea that we want to see if we drop below zero - and if that's the case,
     * when. For this we look at every credit change in the future we know of (sorted ascending, starting with lowest)
     * and check whether we hit zero in that period.
     * @param statement
     * @param numInstances
     * @param considerNextPeriod
     */
    public getRemainingUsageHours(statement: AccountStatement, numInstances: number, considerNextPeriod: boolean = false): number {
        numInstances = Math.max(numInstances, 1);

        // Gather all expected changes to our credits from now (statement.endDate) into the future
        const projectedCreditChanges = this.projectCreditChanges(statement, considerNextPeriod);
        const creditChangesSorted = new SortedArray(projectedCreditChanges, (c1, c2) => orderByDateAscPosFirst(c1, c2));

        // Starting point: the credits we have now are the cummulated remainingAmounts of all credits in the statement
        // that are still valid at statement.endDate
        const creditsNow = statement.credits
            .filter(c => within(statement.endDate, c))
            .reduce((v, c) => (v + (c.remainingAmount !== undefined ? c.remainingAmount : c.amount)), 0);

        // Cycle through all changes and check whether we hit zero credits on the way
        let credits = hoursToMilliseconds(creditsNow);
        let debits = 0;
        let lastCreditChange = { date: statement.endDate, amount: creditsNow };
        let creditChange = creditChangesSorted.popFront();
        let hitZeroDate: string | undefined = credits === 0 ? lastCreditChange.date : undefined;
        while (creditChange) {
            const duration = durationInMillis(creditChange.date, lastCreditChange.date);
            const newDebits = duration * numInstances;
            debits += newDebits;
            if (credits - debits <= 0) {
                if (!hitZeroDate) {
                    // We hit zero. Maybe some future change within GOODWILL will cure us?
                    const timeLeft = credits / numInstances;
                    hitZeroDate = addMillis(lastCreditChange.date, timeLeft);
                }
                if (hitZeroDate && durationInHours(creditChange.date, hitZeroDate) > Accounting.GOODWILL_IN_HOURS) {
                    // No cure in sight.
                    break;
                }
            }

            credits = Math.max(0, credits + hoursToMilliseconds(creditChange.amount));
            if (hitZeroDate && credits > 0) {
                // Cured!
                hitZeroDate = undefined;
            }

            lastCreditChange = creditChange;
            creditChange = creditChangesSorted.popFront();
        }

        if (hitZeroDate) {
            // Calculate projected zero date
            const zeroDate = new Date(hitZeroDate).getTime();
            const endDate = new Date(statement.endDate).getTime();
            return millisecondsToHours(zeroDate - endDate);
        } else {
            // We won't hit zero until next phase
            return millisecondsToHours(credits);
        }
    }

    /**
     * Project all expected changes to credits, starting from statement.endDate up to including the first regular
     * subscription period (=the first subscription period with no one-time packages).
     * @param statement
     * @param considerNextPeriod
     */
    protected projectCreditChanges(statement: AccountStatement, considerNextPeriod: boolean) {
        const creditChanges: CreditChange[] = [];
        const addCreditChange = (credit: OpenCredit) => {
            // Just being defensive, credits should always have remainingAmount
            if (credit.remainingAmount !== undefined && credit.remainingAmount > 0) {
                creditChanges.push({
                    date: credit.date,
                    amount: credit.remainingAmount
                });
                creditChanges.push({
                    date: credit.expiryDate,
                    amount: -credit.remainingAmount
                });
            }
        };
        // statement.credits include one-time packages as well as subscription billing periods started before endDate
        statement.credits.forEach(addCreditChange);

        // We're only interested in the first full subscription cycle after the last (possible irregular) credit expired
        const lastCreditExpiryDate = statement.credits.reduce((p, c) => p < c.expiryDate ? c.expiryDate : p, statement.endDate);
        const lastDateOfInterest = oneMonthLater(lastCreditExpiryDate);
        const subscriptionCredits = this.projectSubscriptionsCredits(statement.subscriptions, statement.userId, statement.endDate, lastDateOfInterest, false);
        subscriptionCredits.forEach(addCreditChange);

        if (considerNextPeriod) {
            return creditChanges.filter(c => c.date > statement.endDate);
        } else {
            return creditChanges.filter(c => c.date > statement.endDate
                && c.date < lastDateOfInterest);
        }
    }

    /**
     * Generates an AccountStatement for the given endDate by trying to match debits (generated by workspaces usage) to credits (generated by subscriptions/packages).
     * Currently starting from user creation date each run.
     * @param userId
     * @param endDate
     */
    public async getAccountStatement(userId: string, endDate: string): Promise<AccountStatement> {
        const userCreationDate = await this.getUserCreationDate(userId);
        const startDate = userCreationDate;     // TODO persistence: Fetch from Accounting DB!
        const unorderedOpenCredits = await this.projectCreditSources(userId, userCreationDate, startDate, endDate);
        const openCredits = new SortedArray<OpenCredit>(unorderedOpenCredits, orderByExpiryDateDesc);
        const openDebits = new SortedArray<OpenDebit>(await this.projectDebits(userId, startDate, endDate), orderByDateDescEndDateDesc);

        const { credits, debits } = this.enterDebits(userId, openDebits, openCredits, endDate);
        this.handleExpiry(userId, startDate, endDate, openCredits, credits, debits);

        return {
            userId,
            subscriptions: await this.getNotYetCancelledSubscriptions(userId, userCreationDate, endDate),
            startDate,
            endDate,
            credits,
            debits,
            remainingHours: this.getRemainingHours(credits, endDate)
        };
    }

    /**
     * Projects all kinds of credit sources (with possible dynamic/unbound date boundaries) into billing periods with fixed validity within the given fixed date boundaries
     *
     * @param userId
     * @param userCreationDate
     * @param startDate
     * @param endDate
     */
    protected async projectCreditSources(userId: string, userCreationDate: string, startDate: string, endDate: string): Promise<OpenCredit[]> {
        const creditEntries: OpenCredit[] = [];
        // Subscriptions
        const subscriptions = await this.subscriptionService.getSubscriptionHistoryForUserInPeriod({ id: userId, creationDate: userCreationDate }, startDate, endDate);
        const subscriptionCredits = this.projectSubscriptionsCredits(subscriptions, userId, startDate, endDate);
        subscriptionCredits.forEach((c) => creditEntries.push(c));

        // Credits
        // TODO persistence: How to match fixed credits and already persistent subscription (chunks)?
        const credits = await this.accountingDB.findOpenCredits(userId, endDate);
        credits.forEach((c) => creditEntries.push(c));
        return [...credits, ...subscriptionCredits].sort(orderCreditFirst);
    }

    /**
     * Projects multiple, possibly unbound subscriptions into a fixed, given period
     * @param subscriptions
     * @param userId
     * @param startDate
     * @param endDate
     * @param includeFirstTruncatedPeriod
     */
    protected projectSubscriptionsCredits(subscriptions: Subscription[], userId: string, startDate: string, endDate: string, includeFirstTruncatedPeriod: boolean = true): OpenCredit[] {
        const creditEntries: OpenCredit[] = [];
        for (const subscription of subscriptions) {
            // No overlap at all? Next.
            if (subscription.startDate >= endDate
                || (subscription.endDate && subscription.endDate <= startDate)) {
                continue;
            }

            let billingPeriodStart = subscription.startDate;
            while (billingPeriodStart < endDate
                && (!subscription.endDate || billingPeriodStart < subscription.endDate)) {
                let firstPeriod = false;
                let billingPeriodEnd = oneMonthLater(billingPeriodStart, new Date(subscription.startDate).getDate());
                if (billingPeriodEnd <= startDate) {
                    billingPeriodStart = billingPeriodEnd;
                    // Still waiting to hit the first overlapping period
                    continue;
                }
                if (billingPeriodStart < startDate) {
                    // First overlap here
                    firstPeriod = true;
                    if (includeFirstTruncatedPeriod) {
                        billingPeriodStart = startDate;
                    } else {
                        billingPeriodStart = billingPeriodEnd;
                        continue;
                    }
                }
                billingPeriodEnd = earliest(billingPeriodEnd, subscription.endDate || billingPeriodEnd);
                const amount = firstPeriod && !!subscription.firstMonthAmount ? subscription.firstMonthAmount : subscription.amount;
                creditEntries.push(AccountEntry.create({
                    userId: userId,
                    amount,
                    // TODO persistence: Need to insert newtrunc.amount=truncBefore.remainingAmount
                    remainingAmount: subscription.amount,
                    date: billingPeriodStart,
                    expiryDate: billingPeriodEnd,
                    kind: 'credit',
                    description: <CreditDescription>{
                        subscriptionId: subscription.uid,
                        planId: subscription.planId
                    }
                }));
                billingPeriodStart = billingPeriodEnd;
            }
        }
        return creditEntries;
    }

    /**
     * Projects (possibly unbound) workspaces sessions into a fixed, given period
     * @param userId
     * @param startDate
     * @param endDate
     */
    protected async projectDebits(userId: string, startDate: string, endDate: string): Promise<OpenDebit[]> {
        const sessions = await this.workspaceDB.findSessionsInPeriod(userId, startDate, endDate);
        return sessions
            .filter(s => s.instance.startedTime !== undefined)
            .filter(s => this.shouldGetBilled(s))
            .map<OpenDebit>(s => {
                const wsi = s.instance;
                const sessionStartDate = oldest(wsi.startedTime!, startDate);
                const sessionEndDate = earliest(wsi.stoppingTime || wsi.stoppedTime || endDate, endDate);
                return {
                    userId,
                    amount: -durationInHours(sessionEndDate, wsi.startedTime!),
                    date: sessionStartDate,
                    endDate: sessionEndDate,
                    kind: 'session',
                    description: <SessionDescription>{
                        contextTitle: s.workspace.context.title,
                        contextUrl: s.workspace.contextURL,
                        workspaceId: s.workspace.id,
                        workspaceInstanceId: wsi.id,
                    }
                };
            });
    }

    /**
     * 1. We bill regular workspaces
     * 2. Prebuilds are for free
     * @param session
     * @returns Whether the given session is billed as regular workspace
     */
    protected shouldGetBilled(s: WorkspaceInstanceSessionWithWorkspace) {
        // all regular workspaces get billed
        if (s.workspace.type == 'regular') {
            return true;
        }

        // no probe workspaces get billed (shouldn't matter - they're never on the account of a "real" user anyways)
        if (s.workspace.type == "probe") {
            return false;
        }

        // no prebuilds get billed
        if (s.workspace.type == "prebuild") {
            return false;
        }

        log.warn("unknown workspace type - cannot decide if this workspace ought to be billed or not", s);
        return false;
    }

    /**
     * Tries to enter each openDebit against an openCredit. If it does not find one the debits are entered as 'loss'.
     * The main idea is to have two queues: one with the open debits, one with the open credits. We want to enter
     * debits against credits oldest to youngest, but use the credits with the earliest expiryDate first.
     * For this to work properly we have to truncate debits on each credit boundary
     * @param userId
     * @param openDebits
     * @param openCredits
     * @param endDate
     */
    protected enterDebits(userId: string, openDebits: SortedArray<OpenDebit>, openCredits: SortedArray<OpenCredit>, endDate: string) {
        const debits: Debit[] = [];
        const credits: Credit[] = [];
        let openDebit = openDebits.pop();   // Debit with earliest date first
        while (openDebit) {
            // Find a credit entry we can enter our debits against
            let openCredit: OpenCredit | undefined;
            for (let i = openCredits.length - 1; i >= 0; i--) {  // Start from end (earliest first)
                const oc = openCredits.get(i);
                if (doesOverlapWith(openDebit, oc)) {
                    openCredit = oc;
                    openCredits.splice(i, 1);
                    break;
                }
            }

            // No credit to pay our debits with: Enter as loss
            if (!openCredit) {
                debits.push(AccountEntry.create<LossDebit>({
                    userId,
                    amount: -openDebit.amount,
                    date: openDebit.endDate,
                    kind: 'loss',
                    description: openDebit.description
                }));
                openDebit = openDebits.pop();
                continue;
            }

            // Take care of left boundary
            if (openDebit.date < openCredit.date) {
                const { before, after } = this.truncateDebitLeft(openDebit, openCredit.date);
                if (before) {
                    // In this case we need a fresh start to make sure we enter the earliest debit against oldest possible credit
                    openDebits.push(before);
                    openDebits.push(after);
                    openCredits.push(openCredit);
                    openDebit = openDebits.pop();
                    continue;
                }
                openDebit = after;
            }

            // Take care of right boundary
            const { before, after } = this.truncateDebitRight(openDebit, openCredit.expiryDate);
            if (after) {
                openDebits.push(after);
            }
            openDebit = before;

            this.enterDebit(openDebit, openCredit, openDebits, openCredits, debits, credits, endDate);
            openDebit = openDebits.pop();
        }
        return { debits, credits };
    }

    /**
     * Enters the given open debit against the given open credit.
     * @param openDebit
     * @param openCredit
     * @param openDebits
     * @param openCredits
     * @param debits
     * @param credits
     * @param endDate
     */
    protected enterDebit(openDebit: OpenDebit, openCredit: OpenCredit, openDebits: SortedArray<OpenDebit>, openCredits: SortedArray<OpenCredit>, debits: Debit[], credits: Credit[], endDate: string) {
        const debitAmountPos = -hoursToMilliseconds(openDebit.amount);
        const creditAmount = hoursToMilliseconds(openCredit.remainingAmount!);
        const accountableAmount = Math.min(debitAmountPos, creditAmount);
        const remainingCreditAmount = creditAmount - accountableAmount; // min: 0

        const debitEntry = this.toDebitEntry(openDebit, openCredit.uid, -accountableAmount, endDate);
        debits.push(debitEntry);

        openCredit.remainingAmount = millisecondsToHours(remainingCreditAmount);
        if (remainingCreditAmount === 0) {
            credits.push(openCredit);
        } else {
            openCredits.push(openCredit);
        }

        const remainingDebitAmount = millisecondsToHours(debitAmountPos - accountableAmount);
        if (remainingDebitAmount > Accounting.GOODWILL_IN_HOURS) {
            const remainingDebit = {
                ...openDebit,
                amount: -remainingDebitAmount
            };
            openDebits.push(remainingDebit);
        }
    }

    /**
     * Split debit into two around the given date (if necessary)
     * @param debit
     * @param date
     */
    protected truncateDebitLeft(debit: OpenDebit, date: string): { before?: OpenDebit, after: OpenDebit } {
        if (debit.date >= date) {
            return { after: { ...debit } };
        } else {
            return {
                before: {
                    ...debit,
                    amount: -durationInHours(date, debit.date),
                    date: debit.date,
                    endDate: rightBefore(date),
                },
                after: {
                    ...debit,
                    amount: -durationInHours(debit.endDate, date),
                    date: date,
                    endDate: debit.endDate
                }
            };
        }
    }

    /**
     * Split debit into two around the given date (if necessary)
     * @param debit
     * @param date
     */
    protected truncateDebitRight(debit: OpenDebit, date: string | undefined): { before: OpenDebit, after?: OpenDebit } {
        if (!date || isDateSmallerOrEqual(debit.endDate, date)) {
            return { before: { ...debit } };
        } else {
            return {
                before: {
                    ...debit,
                    amount: -durationInHours(date, debit.date),
                    date: debit.date,
                    endDate: rightBefore(date),
                },
                after: {
                    ...debit,
                    amount: -durationInHours(debit.endDate, date),
                    date: date,
                    endDate: debit.endDate
                }
            };
        }
    }

    /**
     * Converts our temporary Debit structure to a AccountEntry of kind 'debit'
     * @param debit
     * @param creditId
     * @param amount
     * @param endDate
     */
    protected toDebitEntry(debit: OpenDebit, creditId: string, amount: number, endDate: string): Debit {
        const ourDebit = { ...debit };
        delete (ourDebit as any).endDate; // Introduced by spread

        const debitEntry = AccountEntry.create<Debit>({
            ...(ourDebit as Omit<OpenDebit, "endDate">),
            amount: millisecondsToHours(amount),
            // TODO This looks really strange: Judging by amount, endDate is inclusive; here it looks like it's not!
            // Maybe some irregularity aroun endDate and debits? Add tests and clarify!
            date: debit.endDate < endDate ? debit.endDate : rightBefore(debit.endDate),
            creditId
        });
        return debitEntry;
    }

    /**
     * Check all open credits for expiry
     * @param userId
     * @param startDate
     * @param endDate
     * @param openCredits
     * @param credits
     * @param debits
     */
    protected handleExpiry(userId: string, startDate: string, endDate: string, openCredits: SortedArray<OpenCredit>, credits: Credit[], debits: Debit[]) {
        openCredits.forEach(c => {
            if (c.remainingAmount
                && c.remainingAmount! >= 0
                && c.expiryDate
                && startDate <= c.expiryDate
                && c.expiryDate <= endDate) {
                debits.push(AccountEntry.create({
                    userId,
                    amount: -c.remainingAmount,
                    date: rightBefore(c.expiryDate),
                    creditId: c.uid,
                    kind: 'expiry',
                    description: c.description
                }));

                credits.push({
                    ...c,
                    remainingAmount: 0
                })
            } else {
                credits.push(c);
            }
        });
    }

    protected getRemainingHours(credits: AccountEntryFixedPeriod[], date: string): number | 'unlimited' {
        const hasUnlimitedPlan = !!credits.filter(c => within(date, c)).find(c => {
            const desc = c.description as CreditDescription | undefined;
            if (!desc) {
                return false;
            }

            const plan = Plans.getById(desc.planId);
            if (!plan) {
                return false;
            }

            return plan.hoursPerMonth === 'unlimited';
        });
        if (hasUnlimitedPlan) {
            return 'unlimited';
        }

        return credits
            .filter(c => within(date, c))
            .reduce((v, c) => (v + (c.remainingAmount !== undefined ? c.remainingAmount : c.amount)), 0);
    }

    protected async getUserCreationDate(userId: string): Promise<string> {
        const user = await this.userDB.findUserById(userId);
        if (!user) {
            throw new Error(`Cannot find user with id: ${userId}`);
        }
        return user.creationDate;
    }

    protected async getNotYetCancelledSubscriptions(userId: string, userCreationDate: string, date: string): Promise<Subscription[]> {
        const subscriptions = await this.subscriptionService.getNotYetCancelledSubscriptions({ id: userId, creationDate: userCreationDate }, date);
        if (subscriptions.length === 0) {
            log.info({ userId }, `No uncancelled subscription found at ${date}`);
            throw Error(`No uncancelled subscription for ${userId} at ${date}!`);
        }
        return subscriptions;
    }
}

interface CreditChange {
    date: string,
    amount: number
}

type OpenDebit = Omit<AccountEntry, 'uid'> & {
    endDate: string;
    kind: DebitAccountEntryKind;
}
type OpenCredit = AccountEntry & {
    expiryDate: string;
    kind: 'credit';
}

const doesOverlapWith = (debit: OpenDebit, entry: OpenCredit) => {
    return within(debit.date, entry) || within(debit.endDate, entry);
}

const orderByDateDescEndDateDesc = (d1: OpenDebit, d2: OpenDebit) => {
    const toInt = (d: string) => new Date(d).getTime();
    return toInt(d2.date) - toInt(d1.date) || toInt(d2.date) - toInt(d1.date);
};

const orderByDateAscPosFirst = (c1: CreditChange, c2: CreditChange) => {
    const toInt = (d: string) => new Date(d).getTime();
    const diff = toInt(c1.date) - toInt(c2.date);
    if (diff !== 0) return diff;

    if (c1.amount > 0) {
        return -1;
    } else if (c2.amount > 0) {
        return 1;
    }
    return 0;
}
