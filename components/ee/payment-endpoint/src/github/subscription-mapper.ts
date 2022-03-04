/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { injectable, inject } from "inversify";
import { SubscriptionModel } from "../accounting/subscription-model";
import * as Webhooks from '@octokit/webhooks';
import { MarketplacePurchase } from '@octokit/webhooks-types/schema';
import { User } from "@gitpod/gitpod-protocol";
import { Subscription } from "@gitpod/gitpod-protocol/lib/accounting-protocol";
import { UserDB } from "@gitpod/gitpod-db/lib";
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { Plan, Plans } from "@gitpod/gitpod-protocol/lib/plans";

export type MarketplaceEventAll = Webhooks.EmitterWebhookEvent<"marketplace_purchase">;
export type MarketplaceEventPurchased = Webhooks.EmitterWebhookEvent<"marketplace_purchase.purchased">;
export type MarketplaceEventCancelled = Webhooks.EmitterWebhookEvent<"marketplace_purchase.cancelled">;
export type MarketplaceEventChanged = Webhooks.EmitterWebhookEvent<"marketplace_purchase.changed">;
export type MarketplaceEventPendingChange = Webhooks.EmitterWebhookEvent<"marketplace_purchase.pending_change">;
export type MarketplaceEventPendingChangeCancelled = Webhooks.EmitterWebhookEvent<"marketplace_purchase.pending_change_cancelled">;

interface ChangeContext {
    accountID: number
    effectiveDate: string
    prevPlan: Plan
    newPlan: Plan
    oldSubscription?: Subscription
    newStartDate: string
    newAmount: number
}

@injectable()
export class GithubSubscriptionMapper {
    @inject(UserDB) protected readonly userDB: UserDB;

    public async map(evt: MarketplaceEventAll, model: SubscriptionModel): Promise<boolean> {
        const authId = evt.payload.marketplace_purchase.account.id.toString();
        const user = await this.userDB.findUserByIdentity({ authProviderId: "Public-GitHub", authId });
        if (!user) {
            log.error("Received purchase event for an unknown user. Not acting on it.", { evt });
            return false;
        }

        switch (evt.payload.action) {
            case 'purchased':
                this.mapPurchasedEvent(user, evt as MarketplaceEventPurchased, model);
                break;
            case 'cancelled':
                this.mapCancelledEvent(user, evt as MarketplaceEventCancelled, model);
                break;
            case 'changed':
                this.mapChangedEvent(user, evt as MarketplaceEventChanged, model);
                break;
            case 'pending_change':
                this.mapPendingChangeEvent(user, evt as MarketplaceEventPendingChange, model);
                break;
            case 'pending_change_cancelled':
                this.mapPendingChangeCancelledEvent(user, evt as MarketplaceEventPendingChangeCancelled, model);
                break;
            default:
                log.error({userId: user.id}, "Unknown event type. Not acting on it.", { evt });
                return false;
        }

        return true;
    }

    public mapSubscriptionPurchase(user: User, accountID: number, startDate: string, plan: Plan, model: SubscriptionModel) {
        model.add(Subscription.create({
            userId: user.id,
            startDate,
            planId: plan.chargebeeId, // we identify plans by their chargebeeId
            amount: Plans.getHoursPerMonth(plan),
            paymentReference: this.toPaymentRef(accountID),
        }));
        log.debug({userId: user.id}, "adding newly purchased subscription", { plan });
    }

    protected mapPurchasedEvent(user: User, evt: MarketplaceEventPurchased, model: SubscriptionModel) {
        const purchase = evt.payload.marketplace_purchase;
        const plan = this.mapGithubToGitpodPlan(purchase.plan);
        if (!plan) {
            log.error({userId: user.id}, "cannot map GitHub plan to our own. Not acting on it.", { evt });
            return;
        }

        this.mapSubscriptionPurchase(user, purchase.account.id, evt.payload.effective_date, plan, model);
    }

    public mapSubscriptionCancel(userId: string, effectiveDate: string, model: SubscriptionModel) {
        // This is a bit of a catch-all: ideally this function would only cancel the current subscription.
        // Just in case we got something wrong, we might want to cancel all GitHub subscriptions for this user.
        // We can do that because GitHub can only have one active subscription at a time, i.e. cancelling that
        // one cancels all of them.
        const subscriptions = model.findOpenSubscriptions().filter(s => s.paymentReference && s.paymentReference.startsWith("github:"));
        for (const subscription of subscriptions) {
            model.cancel(subscription, effectiveDate, effectiveDate);
            log.debug({userId}, "cancelling subscription", { subscriptionId: subscription.uid });
        }
    }

    protected mapCancelledEvent(user: User, evt: MarketplaceEventCancelled, model: SubscriptionModel) {
        this.mapSubscriptionCancel(user.id, evt.payload.effective_date, model);
    }

    public mapSubscriptionChange(user: User, context: ChangeContext, model: SubscriptionModel) {
        const { prevPlan, oldSubscription, newAmount, newStartDate, newPlan } = context;

        if (prevPlan.type == 'free') {
            // we've changed from the free plan which means we've purchased a new subscription
            log.debug({userId: user.id}, "upgrading from free plan");
            this.mapSubscriptionPurchase(user, context.accountID, context.effectiveDate, newPlan, model);
            return;
        }
        if (newPlan.type == 'free') {
            // we've changed to the free plan which means we're canceling the current subscription
            log.debug({userId: user.id}, "downgrading to free plan");
            this.mapSubscriptionCancel(user.id, new Date().toISOString(), model);
            return;
        }

        if (!oldSubscription) {
            log.error({ userId: user.id }, "asked to make a subscription change but can't find previous subscription. We just missed a subscription change.", context);
        } else if (oldSubscription.amount > newAmount) {
            // Downgrade
            // 1. Calculate end of current billing period and end oldSubscription there
            model.cancel(oldSubscription, newStartDate, newStartDate);

            // // 2. Create new Gitpod subscription with same paymentReference but new billing period
            model.add(Subscription.create({
                userId: user.id,
                startDate: newStartDate,
                planId: newPlan.chargebeeId,
                amount: newAmount,
                paymentReference: this.toPaymentRef(context.accountID)
            }));
            log.debug({userId: user.id}, "downgraded subscription", { subscription: oldSubscription.uid, plan: newPlan });
        } else if (oldSubscription.amount < newAmount) {
            // Upgrade
            oldSubscription.amount = newAmount;
            oldSubscription.planId = newPlan.chargebeeId;
            model.update(oldSubscription);
            log.debug({userId: user.id}, "upgraded subscription", { subscription: oldSubscription.uid, plan: newPlan });
        } else {
            // Update: This may be the case if the subscription was updated in chargebee, for instance
            oldSubscription.amount = newAmount;
            oldSubscription.planId = newPlan.chargebeeId;
            model.update(oldSubscription);
            log.debug({userId: user.id}, "updated subscription", { subscription: oldSubscription.uid, plan: newPlan });
        }
    }

    protected mapChangedEvent(user: User, evt: Webhooks.EmitterWebhookEvent<"marketplace_purchase.changed">, model: SubscriptionModel) {
        const context = this.getChangeContext(evt.payload, user.id, model);
        if (!context) {
            log.debug({userId: user.id}, "cannot get change context", {evt});
            return;
        }

        this.mapSubscriptionChange(user, context, model);
    }

    protected mapPendingChangeEvent(user: User, evt: MarketplaceEventPendingChange, model: SubscriptionModel) {
        const context = this.getChangeContext(evt.payload, user.id, model);
        if (!context) {
            log.debug({userId: user.id}, "cannot get change context", {evt});
            return;
        }
        const { oldSubscription, newStartDate, newPlan } = context;

        if (!oldSubscription) {
            log.error({ userId: user.id }, "received pending change event but can't find previous subscription", evt);
            return;
        }

        if (!oldSubscription.paymentData) {
            oldSubscription.paymentData = {};
        }
        oldSubscription.paymentData.downgradeDate = newStartDate;
        oldSubscription.paymentData.newPlan = newPlan.chargebeeId;
        model.update(oldSubscription);
        log.debug({userId: user.id}, "marked subscription as pending", { subscription: oldSubscription.uid });
    }

    protected mapPendingChangeCancelledEvent(user: User, evt: MarketplaceEventPendingChangeCancelled, model: SubscriptionModel) {
        const context = this.getChangeContext(evt.payload, user.id, model);
        if (!context) {
            log.debug({userId: user.id}, "cannot get change context", {evt});
            return;
        }
        const { oldSubscription } = context;

        if (!oldSubscription) {
            log.warn({ userId: user.id }, "received change canceled event but can't find previous subscription - adding to pending events", evt);
            // TODO: add to pending events
            return;
        }

        if (oldSubscription.paymentData) {
            oldSubscription.paymentData.downgradeDate = undefined;
            model.update(oldSubscription);
        }
    }

    protected mapGithubToGitpodPlan(plan: MarketplacePurchase["plan"] | undefined): Plan | undefined {
        if (!plan) {
            return undefined;
        }

        // GitHub plans are all in USD
        const thisPlan = Plans.getAvailablePlans('USD').filter(p => p.githubId == plan.id);
        if (thisPlan.length == 0) {
            return;
        }

        return thisPlan[0];
    }

    protected getChangeContext(payload: MarketplaceEventPendingChange["payload"] | MarketplaceEventChanged["payload"] | MarketplaceEventPendingChangeCancelled["payload"], userId: string, model: SubscriptionModel): ChangeContext | undefined {
        const prevPurchase = payload.previous_marketplace_purchase;
        const prevPlan = this.mapGithubToGitpodPlan(prevPurchase?.plan);
        if (!prevPlan) {
            log.error({userId}, "Cannot map the previous GitHub plan to our own. Not acting on it.", { payload });
            return;
        }

        const newPurchase = payload.marketplace_purchase;
        const newPlan = this.mapGithubToGitpodPlan(newPurchase.plan);
        if (!newPlan) {
            log.error({userId}, "Cannot map new GitHub plan to our own. Not acting on it.", { payload });
            return;
        }

        let oldSubscription: Subscription | undefined;
        const subscriptions = model.findOpenSubscriptions(prevPlan.chargebeeId);
        if (subscriptions.length == 0) {
            log.error({userId}, "Cannot find GitHub purchase.", { payload });
        } else if (subscriptions.length > 1) {
            log.error({userId}, "Cannot identify GitHub purchase.", { payload });
        } else {
            oldSubscription = subscriptions[0];
        }
        const newStartDate = payload.effective_date;
        const newAmount = Plans.getHoursPerMonth(newPlan);

        return {
            accountID: payload.marketplace_purchase.account.id,
            effectiveDate: payload.effective_date,
            newAmount,
            newPlan,
            newStartDate,
            oldSubscription,
            prevPlan
        }
    }

    public toPaymentRef(githubAccountID: number): string {
        // github does not identify individual purchases ... that makes things a tad tricky
        return `github:${githubAccountID}`;
    }

}