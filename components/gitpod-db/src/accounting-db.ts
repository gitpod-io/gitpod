/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { AccountEntry, Subscription, SubscriptionAndUser, Credit } from "@gitpod/gitpod-protocol/lib/accounting-protocol";
import { DBSubscriptionAdditionalData, DBPaymentSourceInfo } from "./typeorm/entity/db-subscription";
import { DeepPartial, EntityManager } from "typeorm";

export const TransactionalAccountingDBFactory = Symbol('TransactionalAccountingDBFactory');
export interface TransactionalAccountingDBFactory {
    (manager: EntityManager): AccountingDB;
}

export const AccountingDB = Symbol('AccountingDB');

export interface AccountingDB {
    newAccountEntry(entry: Omit<AccountEntry, 'uid'>): Promise<AccountEntry>;
    storeAccountEntry(AccountEntry: AccountEntry): void;
    findAccountEntriesFor(userId: string, fromDate: string, toDate: string): Promise<AccountEntry[]>;
    findOpenCredits(userId: string, date: string): Promise<Credit[]>;

    newSubscription(subscription: Omit<Subscription, 'uid'>): Promise<Subscription>;
    storeSubscription(subscription: Subscription): Promise<Subscription>;
    findSubscriptionById(id: string): Promise<Subscription | undefined>;
    deleteSubscription(subscription: Subscription): Promise<void>
    findActiveSubscriptions(fromDate: string, toDate: string): Promise<Subscription[]>;
    findActiveSubscriptionsForUser(userId: string, fromDate: string): Promise<Subscription[]>;
    findActiveSubscriptionsByIdentity(authId: string[], authProvider: string): Promise<{ [authId:string]:SubscriptionAndUser[] }>;
    findActiveSubscriptionByPlanID(planID: string, date: string): Promise<Subscription[]>;
    findAllSubscriptionsForUser(userId: string): Promise<Subscription[]>;
    findSubscriptionsForUserInPeriod(userId: string, fromDate: string, toDate: string): Promise<Subscription[]>;
    findNotYetCancelledSubscriptions(userId: string, date: string): Promise<Subscription[]>;
    findSubscriptionForUserByPaymentRef(userId: string, paymentReference: string): Promise<Subscription[]>;
    findSubscriptionsByTeamSubscriptionSlotId(teamSubscriptionSlotId: string): Promise<Subscription[]>;

    hadSubscriptionCreatedWithCoupon(userId: string, coupon: string): Promise<boolean>;
    findSubscriptionAdditionalData(paymentReference: string): Promise<DBSubscriptionAdditionalData | undefined>;

    transaction<T>(closure: (db: AccountingDB)=>Promise<T>, closures?: ((manager: EntityManager) => Promise<any>)[]): Promise<T>;

    storeSubscriptionAdditionalData(subscriptionData: DBSubscriptionAdditionalData): Promise<DBSubscriptionAdditionalData>;
    storePaymentSourceInfo(cardInfo: DBPaymentSourceInfo): Promise<DBPaymentSourceInfo>;
}

export type DBPaymentSourceInfoPartial = DeepPartial<DBPaymentSourceInfo> & Pick<DBPaymentSourceInfo, "id">;