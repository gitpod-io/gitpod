/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { Config } from "../config";
import { inject, injectable } from "inversify";
import * as fs from 'fs';
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import * as jwt from 'jsonwebtoken';
import { PendingGithubEventDB, UserDB } from "@gitpod/gitpod-db/lib";
import { GithubSubscriptionMapper, MarketplaceEventAll } from "./subscription-mapper";
import { User, Queue } from "@gitpod/gitpod-protocol";
import { UserPaidSubscription } from "@gitpod/gitpod-protocol/lib/accounting-protocol";
import { AccountingDB } from "@gitpod/gitpod-db/lib/accounting-db";
import { SubscriptionModel } from "../accounting/subscription-model";
import { Plans, Plan } from "@gitpod/gitpod-protocol/lib/plans";
import * as Webhooks from '@octokit/webhooks';
import fetch from "node-fetch";

@injectable()
export class GithubSubscriptionReconciler {
    @inject(GithubSubscriptionMapper) protected readonly subscriptionMapper: GithubSubscriptionMapper;
    @inject(PendingGithubEventDB) protected readonly pendingEventsDB: PendingGithubEventDB;
    @inject(AccountingDB) protected readonly accountingDB: AccountingDB;
    @inject(UserDB) protected readonly userDB: UserDB;
    @inject(Config) protected readonly config: Config;
    protected privateKey: string | undefined;
    protected reconciliationTasks = new Queue();


    public async handleIncomingEvent(evt: MarketplaceEventAll) {
        const authId: string = evt.payload.marketplace_purchase.account.id.toString();
        const user = await this.userDB.findUserByIdentity({ authProviderId: "Public-GitHub", authId });
        if (user) {
            // This will become a performance bottleneck if we have too many operations coming in.
            // The only reason we're enqueueing the event reconciliation here is because pollAndReconcilFromGithub does
            // not run in a transaction. Maybe we should do that instead.
            await this.reconciliationTasks.enqueue(() => this.reconcileEvent(user, evt));
        } else {
            log.error("Received GitHub marketplace purchase event for an unknown user. Storing for later use.", {evt});
            await this.pendingEventsDB.store({
                creationDate: new Date(),
                event: JSON.stringify(evt),
                githubUserId: evt.payload.marketplace_purchase.account.id.toString(),
                id: evt.id,
                type: `marketplace_purchase.${evt.payload.action}`
            });
        }
    }

    protected async reconcilePendingEvents() {
        const pendingPurchaseEvents = await this.pendingEventsDB.findWithUser("marketplace_purchase");
        for (const evt of pendingPurchaseEvents) {
            try {
                const githubEvt = JSON.parse(evt.event);
                await this.reconcileEvent(evt.identity.user, githubEvt);
                await this.pendingEventsDB.delete(evt);
                log.debug({userId: evt.identity.user.id}, "followed up on pending purchasing event", {evt});
            } catch(err) {
                log.debug("could not follow up on pending event", err);
            }
        }
    }

    protected async pollAndReconcilFromGithub() {
        if (!this.privateKey) {
            this.privateKey = loadPrivateKey(this.config.githubAppCertPath)!;
        }

        const now = Math.floor(Date.now() / 1000)
        const payload = {
            iat: now, // Issued at time
            exp: now + 60, // JWT expiration time (10 minute maximum)
            iss: this.config.githubAppAppID.toString()
        };
        const token = jwt.sign(payload, this.privateKey, { algorithm: 'RS256' })

        await Promise.all(Plans.getAvailablePlans('USD').filter(p => !!p.githubId).map(p => this.reconcilePlan(p, token)));
    }

    protected async reconcilePlan(plan: Plan, token: string) {
        log.debug("Reconciling plan", {name: plan.name, githubId: plan.githubId});

        const maxPlanAccounts = 2000;
        let allPlanAccounts = new Map<number, MarketplaceAccountListing>();
        for (let i = 1; i < maxPlanAccounts; i++) {
            const resp = await fetch(`https://api.github.com/marketplace_listing/plans/${plan.githubId}/accounts?sort=updated&direction=desc&page=${i}`, {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer ' + token,
                    accept: 'application/vnd.github.machine-man-preview+json',
                    'User-Agent': 'gitpod/payment'
                }
            });

            const items: MarketplaceAccountListing[] = JSON.parse(await resp.text());
            if (items.length == 0) {
                // we've reached the end of the list, i.e. the page GitHub gave us is empty
                break;
            }
            for (const item of items) {
                allPlanAccounts.set(item.id, item);
            }

        }
        if (allPlanAccounts.size > maxPlanAccounts) {
            log.error(`Gitpod has ${allPlanAccounts.size} plan accounts on GitHub. That's awesome. Now we should rethink our reconciling strategy.`);
        }

        // compare GitHub with database
        const accounts = [...allPlanAccounts.keys()];
        if (accounts.length == 0) {
            return;
        }

        const matchingSubscriptions = await this.accountingDB.findActiveSubscriptionsByIdentity(accounts.map(k => k.toString()), "Public-GitHub");
        for (const account of accounts) {
            const subscriptions = (matchingSubscriptions[account.toString()] || []).filter(s => !!s.paymentReference && s.paymentReference.startsWith("github:"));
            const githubUserAndPurchase = allPlanAccounts.get(account)!;

            let model: SubscriptionModel | undefined;
            if (!subscriptions || subscriptions.length == 0) {
                // We do not have a subscription for this user (looks like we've missed an event).

                // This is anything but optimal: we're performing an 1+N query here. Let's hope we don't have to do this
                // all too often, i.e. we don't miss too many events.
                const user = await this.userDB.findUserByIdentity({ authProviderId: "Public-GitHub", authId: account.toString() });
                if (!user) {
                    log.debug("did not find user even though GitHub says they're paying for Gitpod. Maybe user didn't sign up yet.", {account, githubUserAndPurchase});
                    continue;
                }

                // Let's create that subscription.
                model = new SubscriptionModel(user.id, []);
                this.subscriptionMapper.mapSubscriptionPurchase(user, account, new Date().toISOString(), plan, model);
            } else if (subscriptions.length == 1 && subscriptions[0].planId != plan.chargebeeId) {
                const user = subscriptions[0].user;

                // We have an active subscription, but not for this plan. Let's change to new plan.
                model = new SubscriptionModel(user.id, subscriptions);
                this.subscriptionMapper.mapSubscriptionChange(user, {
                    accountID: account,
                    effectiveDate: new Date().toISOString(),
                    newAmount: Plans.getHoursPerMonth(plan),
                    newPlan: plan,
                    newStartDate: new Date().toISOString(),
                    oldSubscription: subscriptions[0],
                    prevPlan: Plans.getById(subscriptions[0].planId!)!
                }, model);
            } else if (subscriptions.length > 1) {
                // We have multiple subscriptions - for good measure we cancel all of them and start afresh.
                // This is anything but optimal: we're performing an 1+N query here. Let's hope we don't have to do this.
                // all too often, i.e. we don't miss too many events.
                const user = subscriptions[0].user;

                // We have an active subscription, but not for this plan. Let's change to new plan.
                model = new SubscriptionModel(user.id, subscriptions);
                this.subscriptionMapper.mapSubscriptionCancel(user.id, new Date().toISOString(), model);
                this.subscriptionMapper.mapSubscriptionPurchase(user, account, new Date().toISOString(), plan, model);
            } else {
                // all is well
            }

            if (model) {
                // we have some changes that we need to write to the database
                const delta = model.getResult();
                await Promise.all([
                    ...delta.updates.map(s => this.accountingDB.storeSubscription(s)),
                    ...delta.inserts.map(s => this.accountingDB.newSubscription(s))
                ]);
            }
        }

        // compare database with GitHub
        const subscriptionsInDB = (await this.accountingDB.findActiveSubscriptionByPlanID(plan.chargebeeId, new Date().toISOString())).filter(s => !!s.paymentReference && s.paymentReference.startsWith("github:"));
        for (const sub of subscriptionsInDB) {
            const paymentRef = (sub.paymentReference || "").split(":");
            if (paymentRef.length != 2 || paymentRef[0] != "github") {
                // not a GitHub subscription - we don't care
                continue;
            }

            const githubAccountID = parseInt(paymentRef[1]);
            const listing = allPlanAccounts.get(githubAccountID);
            if (!listing) {
                // We have a subscription in our database which GitHub does not know about.
                // We should end this subscription.
                log.warn({ userId: sub.userId }, "Found subscription which GitHub does not know off. Ending subscription.", { subscription: sub });

                // We have an active subscription, but not for this plan. Let's change to new plan.
                const model = new SubscriptionModel(sub.userId, [ sub ]);
                this.subscriptionMapper.mapSubscriptionCancel(sub.userId, new Date().toISOString(), model);
                const delta = model.getResult();
                await Promise.all([
                    ...delta.updates.map(s => this.accountingDB.storeSubscription(s)),
                    ...delta.inserts.map(s => this.accountingDB.newSubscription(s))
                ]);
            }
        }
    }

    public start() {
        setInterval(() => this.reconciliationTasks.enqueue(() => this.reconcilePendingEvents()), 1 * 60 * 1000); // every one minute
        setInterval(() => this.reconciliationTasks.enqueue(async () => {
            try {
                // it's important we reconcile the latest pending events first before attempting to interpret GitHub's information.
                await this.reconcilePendingEvents();

                await this.pollAndReconcilFromGithub();
            } catch (err) {
                log.warn("Error while reconciling latest GitHub state", err);
            }
        }), 24 * 60 * 1000); // once a day
    }

    public async reconcileEvent(user: User, evt: MarketplaceEventAll) {
        const userId = user.id;
        await this.accountingDB.transaction(async db => {
            const subscriptions = await db.findAllSubscriptionsForUser(userId);
            const userPaidSubscriptions = subscriptions.filter(s => UserPaidSubscription.is(s) && s.paymentReference.startsWith("github:"));

            const model = new SubscriptionModel(userId, userPaidSubscriptions);
            const success = await this.subscriptionMapper.map(evt, model);
            if (!success) {
                log.debug({userId}, "subscription mapper did not succeed for GitHub market purchase event. See errors above.", { evt });
                return;
            }

            const delta = model.getResult();
            await Promise.all([
                ...delta.updates.map(s => db.storeSubscription(s)),
                ...delta.inserts.map(s => db.newSubscription(s))
            ]);
        });
    }

}


function loadPrivateKey(filename: string | undefined): string | undefined {
    if (!filename) {
        return;
    }

    // const isInTelepresence = !!process.env.TELEPRESENCE_ROOT;
    // const ignoreTelepresence = !!process.env.TELEPRESENCE_ROOT_IGNORE;
    // if (isInTelepresence && !ignoreTelepresence) {
    //     filename = `${process.env.TELEPRESENCE_ROOT}/${filename}`;
    // }

    // loadPrivateKey is used in super call - must not be async
    if (!filename || !fs.existsSync(filename)) {
        return;
    }

    return fs.readFileSync(filename).toString();
}

interface MarketplaceAccountListing {
    url: string
    type: string;
    id: number;
    login: string;
    email?: string;
    marketplace_pending_change?: any; // this seems broken on the GitHub side
    marketplace_purchase: Webhooks.EmitterWebhookEvent<"marketplace_purchase">["payload"];
}