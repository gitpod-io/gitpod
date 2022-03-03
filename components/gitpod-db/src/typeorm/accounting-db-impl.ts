/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { AccountingDB, TransactionalAccountingDBFactory } from '../accounting-db';
import { DBAccountEntry } from './entity/db-account-entry';
import { User } from '@gitpod/gitpod-protocol';
import {
    AccountEntry,
    Subscription,
    Credit,
    SubscriptionAndUser,
} from '@gitpod/gitpod-protocol/lib/accounting-protocol';
import { EntityManager, Repository } from 'typeorm';
import { DBSubscription, DBSubscriptionAdditionalData } from './entity/db-subscription';
import { injectable, inject } from 'inversify';
import { v4 as uuidv4 } from 'uuid';
import { DBUser } from '../typeorm/entity/db-user';
import { TypeORM } from './typeorm';

@injectable()
export class TypeORMAccountingDBImpl implements AccountingDB {
    @inject(TypeORM) typeORM: TypeORM;
    @inject(TransactionalAccountingDBFactory) protected readonly transactionalFactory: TransactionalAccountingDBFactory;

    async transaction<T>(
        closure: (db: AccountingDB) => Promise<T>,
        closures?: ((manager: EntityManager) => Promise<any>)[],
    ): Promise<T> {
        const manager = await this.getEntityManager();
        return await manager.transaction(async (manager) => {
            const transactionDB = this.transactionalFactory(manager);
            const result = await closure(transactionDB);

            for (const c of closures || []) {
                await c(manager);
            }
            return result;
        });
    }

    protected async getEntityManager() {
        return (await this.typeORM.getConnection()).manager;
    }

    protected async getAccountEntryRepo(): Promise<Repository<DBAccountEntry>> {
        return (await this.getEntityManager()).getRepository(DBAccountEntry);
    }

    async newAccountEntry(accountEntry: Omit<AccountEntry, 'uid'>): Promise<AccountEntry> {
        const newEntry = new DBAccountEntry();
        AccountEntry.create(newEntry);
        Object.assign(newEntry, accountEntry);
        return await this.storeAccountEntry(newEntry);
    }

    async storeAccountEntry(accountEntry: AccountEntry): Promise<AccountEntry> {
        return await (await this.getAccountEntryRepo()).save(accountEntry);
    }

    async findAccountEntriesFor(userId: string, fromDate: string, toDate: string): Promise<AccountEntry[]> {
        const query = (await this.getAccountEntryRepo())
            .createQueryBuilder('entry')
            .where('entry.userId = :userId', { userId: userId })
            .andWhere('entry.date >= :startDate', { startDate: fromDate })
            .andWhere('entry.date < :endDate', { endDate: toDate });
        return query.getMany();
    }

    /**
     * @param date inclusive date. Everything after is not taken into account.
     */
    async findOpenCredits(userId: string, date: string): Promise<Credit[]> {
        // TODO ACCOUNTING DB: Review this!
        const repo = await this.getAccountEntryRepo();
        const rows = await repo.query(
            `
            SELECT credit.uid,
                credit.date,
                credit.expiryDate,
                credit.amount,
                credit.description
            FROM d_b_account_entry AS credit
            WHERE credit.userId = ?
                AND credit.kind = "credit"
                AND credit.date <= ?
            ORDER BY expiryDate
        `,
            [userId, date],
        );
        return rows.map((row: any) => {
            return {
                uid: row.uid,
                amount: row.amount,
                remainingAmount: row.amount, // Hack works because we do not persist remainingAmount just yet
                kind: 'open', // ... and thus all 'credit's are 'open'
                date: row.date,
                expiryDate: row.expiryDate ? row.expiryDate : undefined,
                description: row.description ? JSON.parse(row.description) : undefined,
            };
        });
    }

    protected async getSubscriptionRepo(): Promise<Repository<DBSubscription>> {
        return (await this.getEntityManager()).getRepository(DBSubscription);
    }

    protected async getSubscriptionAdditionalDataRepo(): Promise<Repository<DBSubscriptionAdditionalData>> {
        return (await this.getEntityManager()).getRepository(DBSubscriptionAdditionalData);
    }

    async newSubscription(subscription: Omit<Subscription, 'uid'>): Promise<Subscription> {
        const newSubscription = new DBSubscription();
        Subscription.create(newSubscription);
        Object.assign(newSubscription, subscription);
        return await this.storeSubscription(newSubscription);
    }

    async storeSubscription(subscription: Subscription): Promise<Subscription> {
        const dbsub = subscription as DBSubscription;
        if (!dbsub.uid) {
            console.warn(
                'Storing subscription without pre-set UUID. Subscriptions should always be created with newSubscription',
            );
            dbsub.uid = uuidv4();
        }
        return await (await this.getSubscriptionRepo()).save(dbsub);
    }

    async findSubscriptionById(id: string): Promise<Subscription | undefined> {
        const repo = await this.getSubscriptionRepo();
        return repo.findOne(id);
    }

    async deleteSubscription(subscription: Subscription): Promise<void> {
        await (await this.getSubscriptionRepo()).delete(subscription as DBSubscription);
    }

    async findActiveSubscriptionByPlanID(planID: string, date: string): Promise<Subscription[]> {
        return (await this.getSubscriptionRepo())
            .createQueryBuilder('subscription')
            .where('subscription.planID = :planID', { planID })
            .andWhere(
                'subscription.startDate <= :date AND (subscription.endDate = "" OR subscription.endDate > :date)',
                { date: date },
            )
            .andWhere('subscription.deleted != true')
            .andWhere('subscription.planId != "free"') // TODO DEL FREE-SUBS
            .getMany();
    }

    async findActiveSubscriptions(fromDate: string, toDate: string): Promise<Subscription[]> {
        return (await this.getSubscriptionRepo())
            .createQueryBuilder('subscription')
            .where('subscription.startDate <= :to AND (subscription.endDate = "" OR subscription.endDate > :from)', {
                from: fromDate,
                to: toDate,
            })
            .andWhere('subscription.deleted != true')
            .andWhere('subscription.planId != "free"') // TODO DEL FREE-SUBS
            .getMany();
    }

    async findActiveSubscriptionsForUser(userId: string, date: string): Promise<Subscription[]> {
        return (await this.getSubscriptionRepo())
            .createQueryBuilder('subscription')
            .where('subscription.userId  = :userId ', { userId: userId })
            .andWhere(
                'subscription.startDate <= :date AND (subscription.endDate = "" OR subscription.endDate > :date)',
                { date: date },
            )
            .andWhere('subscription.deleted != true')
            .andWhere('subscription.planId != "free"') // TODO DEL FREE-SUBS
            .getMany();
    }

    async findAllSubscriptionsForUser(userId: string): Promise<Subscription[]> {
        return (await this.getSubscriptionRepo())
            .createQueryBuilder('subscription')
            .where('subscription.userId  = :userId ', { userId: userId })
            .andWhere('subscription.deleted != true')
            .andWhere('subscription.planId != "free"') // TODO DEL FREE-SUBS
            .orderBy('subscription.startDate', 'ASC')
            .getMany();
    }

    async findSubscriptionsForUserInPeriod(userId: string, fromDate: string, toDate: string): Promise<Subscription[]> {
        return (await this.getSubscriptionRepo())
            .createQueryBuilder('subscription')
            .where('subscription.userId  = :userId ', { userId: userId })
            .andWhere(
                '(' +
                    // Partial overlaps: start OR end internal
                    '(subscription.startDate >= :from AND subscription.startDate <= :to)' +
                    ' OR (subscription.endDate != "" AND subscription.endDate > :from AND subscription.endDate < :to)' +
                    // Complete overlap: start AND end external
                    ' OR (subscription.startDate < :from AND (subscription.endDate = "" OR subscription.endDate > :to))' +
                    ')',
                { from: fromDate, to: toDate },
            )
            .andWhere('subscription.deleted != true')
            .andWhere('subscription.planId != "free"') // TODO DEL FREE-SUBS
            .getMany();
    }

    async findNotYetCancelledSubscriptions(userId: string, date: string): Promise<Subscription[]> {
        return (await this.getSubscriptionRepo())
            .createQueryBuilder('subscription')
            .where('subscription.userId  = :userId ', { userId: userId })
            .andWhere('(subscription.cancellationDate = "" OR subscription.cancellationDate > :date)', { date: date })
            .andWhere('subscription.deleted != true')
            .andWhere('subscription.planId != "free"') // TODO DEL FREE-SUBS
            .getMany();
    }

    async findSubscriptionForUserByPaymentRef(userId: string, paymentReference: string): Promise<Subscription[]> {
        return (await this.getSubscriptionRepo())
            .createQueryBuilder('subscription')
            .where('subscription.userId  = :userId ', { userId: userId })
            .andWhere('subscription.paymentReference = :paymentReference', { paymentReference })
            .andWhere('subscription.deleted != true')
            .andWhere('subscription.planId != "free"') // TODO DEL FREE-SUBS
            .orderBy('subscription.startDate', 'DESC')
            .getMany();
    }

    async findSubscriptionsByTeamSubscriptionSlotId(teamSubscriptionSlotId: string): Promise<Subscription[]> {
        return (await this.getSubscriptionRepo())
            .createQueryBuilder('subscription')
            .where('subscription.teamSubscriptionSlotId = :teamSubscriptionSlotId', {
                teamSubscriptionSlotId: teamSubscriptionSlotId,
            })
            .andWhere('subscription.deleted != true')
            .andWhere('subscription.planId != "free"') // TODO DEL FREE-SUBS
            .orderBy('subscription.startDate', 'DESC')
            .getMany();
    }

    async findActiveSubscriptionsByIdentity(
        authId: string[],
        authProvider: string,
    ): Promise<{ [authId: string]: SubscriptionAndUser[] }> {
        const repo = await this.getSubscriptionRepo();
        const query = repo
            .createQueryBuilder('sub')
            .innerJoinAndMapOne('sub.user', DBUser, 'user', 'sub.userId = user.id')
            .innerJoinAndSelect(
                'user.identities',
                'ident',
                'ident.authId = :authId AND ident.authProviderId = :authProvider',
                { authId, authProvider },
            )
            .where('sub.startDate <= :date AND (:date < sub.endDate OR sub.endDate = "")', {
                date: new Date().toISOString(),
            })
            .andWhere('sub.deleted != true')
            .andWhere('sub.planId != "free"')
            .orderBy('sub.startDate', 'ASC');

        const rows = await query.getMany();
        const result: { [authId: string]: SubscriptionAndUser[] } = {};
        for (const r of rows) {
            const authId = ((r as any).user as User).identities[0].authId;
            const subs = result[authId] || [];
            subs.push(r as SubscriptionAndUser);
            result[authId] = subs;
        }
        return result;
    }

    async hadSubscriptionCreatedWithCoupon(userId: string, couponId: string): Promise<boolean> {
        const repo = await this.getSubscriptionAdditionalDataRepo();
        const query = repo
            .createQueryBuilder('sad')
            .select('1')
            .leftJoinAndMapOne(
                'sad.paymentReference',
                DBSubscription,
                'sub',
                'sub.paymentReference = sad.paymentReference',
            )
            .where('sub.userId = :userId', { userId })
            // Either:
            //  - it was created with that coupon
            //  - or it still has that coupon applied.
            .andWhere(
                `(
                    JSON_SEARCH(JSON_EXTRACT(sad.coupons, '$[*].coupon_id'), 'one', :couponId) IS NOT NULL
                )`,
                { couponId },
            );
        return (await query.getCount()) > 0;
    }

    async findSubscriptionAdditionalData(paymentReference: string): Promise<DBSubscriptionAdditionalData | undefined> {
        const repo = await this.getSubscriptionAdditionalDataRepo();
        return repo
            .createQueryBuilder('sad')
            .where('sad.paymentReference = :paymentReference', { paymentReference })
            .getOne();
    }

    async storeSubscriptionAdditionalData(
        subscriptionData: DBSubscriptionAdditionalData,
    ): Promise<DBSubscriptionAdditionalData> {
        const repo = await this.getSubscriptionAdditionalDataRepo();
        return repo.save(subscriptionData);
    }
}

export class TransactionalAccountingDBImpl extends TypeORMAccountingDBImpl {
    constructor(protected readonly manager: EntityManager) {
        super();
    }

    async getEntityManager(): Promise<EntityManager> {
        return this.manager;
    }
}
