/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { Subscription } from '@gitpod/gitpod-protocol/lib/accounting-protocol';
import * as chai from 'chai';
import { suite, test, timeout } from 'mocha-typescript';
import { QueryRunner } from 'typeorm';
import { AccountingDB } from './accounting-db';
import { oneMonthLater, rightAfter, rightBefore } from '@gitpod/gitpod-protocol/lib/util/timeutil';
import { DBAccountEntry } from './typeorm/entity/db-account-entry';
import { TransactionalAccountingDBImpl } from './typeorm/accounting-db-impl';
import { DBWorkspace } from './typeorm/entity/db-workspace';
import { DBWorkspaceInstance } from './typeorm/entity/db-workspace-instance';
import { DBPaymentSourceInfo, DBSubscription } from './typeorm/entity/db-subscription';
import { testContainer } from './test-container';
import { TypeORM } from './typeorm/typeorm';
const expect = chai.expect;

@suite @timeout(5000)
export class AccountingDBSpec {

    typeORM = testContainer.get<TypeORM>(TypeORM);
    db: AccountingDB;
    queryRunner: QueryRunner;

    async before() {
        const connection = await this.typeORM.getConnection();
        const manager = connection.manager;
        await manager.clear(DBAccountEntry);
        await manager.clear(DBSubscription);
        await manager.clear(DBWorkspaceInstance);
        await manager.clear(DBWorkspace);

        this.queryRunner = connection.createQueryRunner();
        await this.queryRunner.connect();
        await this.queryRunner.startTransaction();
        this.db = new TransactionalAccountingDBImpl(this.queryRunner.manager)
    }

    async after() {
        this.queryRunner.rollbackTransaction();
    }

    @test public async subscriptionFixedPeriod() {
        const now = new Date().toISOString();
        const later = oneMonthLater(now, 31);
        const inBetween = new Date(0.5 * (new Date(now).getTime() + new Date(later).getTime())).toISOString();

        const subscription = <Subscription>{
            userId: "Now open",
            startDate: now,
            endDate: later,
            amount: 1.01,
            planId: 'test'
        };
        await this.db.newSubscription(subscription);

        // date inclusion
        expectExactlyOne(await this.db.findActiveSubscriptions(now, now), subscription);
        expectExactlyOne(await this.db.findActiveSubscriptions(now, inBetween), subscription);
        expectExactlyOne(await this.db.findActiveSubscriptions(inBetween, later), subscription);
        expectExactlyOne(await this.db.findActiveSubscriptions(now, later), subscription);
        expectExactlyOne(await this.db.findActiveSubscriptions(rightBefore(later), rightBefore(later)), subscription);

        // date exclusion
        expect(await this.db.findActiveSubscriptions(later, later)).to.be.empty;
        expect(await this.db.findActiveSubscriptions(rightBefore(now), rightBefore(now))).to.be.empty;
    }

    @test public async subscriptionOpenEnd() {
        const now = new Date().toISOString();
        const later = oneMonthLater(now, 31);
        const inBetween = new Date(0.5 * (new Date(now).getTime() + new Date(later).getTime())).toISOString();

        const subscription = <Subscription>{
            userId: "Open ended",
            startDate: now,
            endDate: undefined, // open ended
            amount: 1.01,
            planId: 'test'
        };
        await this.db.newSubscription(subscription);

        // date inclusion
        expectExactlyOne(await this.db.findActiveSubscriptions(now, now), subscription);
        expectExactlyOne(await this.db.findActiveSubscriptions(later, later), subscription);
        expectExactlyOne(await this.db.findActiveSubscriptions(now, inBetween), subscription);
        expectExactlyOne(await this.db.findActiveSubscriptions(inBetween, later), subscription);
        expectExactlyOne(await this.db.findActiveSubscriptions(now, later), subscription);
        expectExactlyOne(await this.db.findActiveSubscriptions(rightAfter(later), rightAfter(later)), subscription);

        // date exclusion
        expect(await this.db.findActiveSubscriptions(rightBefore(now), rightBefore(now))).to.be.empty;
    }

    @test public async subscriptionUpdate() {
        const now = new Date().toISOString();
        const later = oneMonthLater(now, 31);
        const subscription = <Subscription>{
            userId: "Open ended",
            startDate: now,
            endDate: undefined, // open ended
            amount: 1.01,
            planId: 'test'
        };
        const dbSubscription = await this.db.newSubscription(subscription);
        expectExactlyOne(await this.db.findActiveSubscriptions(now, rightAfter(later)), subscription);
        expect(await this.db.findActiveSubscriptions(rightBefore(now), rightBefore(now))).to.be.empty;
        Subscription.cancelSubscription(dbSubscription, later);
        await this.db.storeSubscription(dbSubscription)
        expect(await this.db.findActiveSubscriptions(rightAfter(later), rightAfter(later))).to.be.empty;
        await this.db.storeSubscription(dbSubscription)
        expect(await this.db.findActiveSubscriptions(rightAfter(later), rightAfter(later))).to.be.empty;
    }

    @test public async subscriptionsForUser() {
        const now = new Date().toISOString();
        const later = oneMonthLater(now, 31)
        const subscription = <Subscription>{
            userId: "Open ended",
            startDate: now,
            endDate: undefined, // open ended
            amount: 1.01,
            planId: 'test'
        };
        let dbSubscription = await this.db.newSubscription(subscription);
        expectExactlyOne(await this.db.findActiveSubscriptionsForUser(subscription.userId, now), subscription);
        expect(await this.db.findActiveSubscriptionsForUser(subscription.userId, rightBefore(now))).to.be.an('array').and.empty;
        expectExactlyOne(await this.db.findActiveSubscriptionsForUser(subscription.userId, later), subscription);
        Subscription.cancelSubscription(dbSubscription, later);
        await this.db.storeSubscription(dbSubscription);

        expectExactlyOne(await this.db.findActiveSubscriptionsForUser(subscription.userId, rightBefore(later)), dbSubscription);
        expect(await this.db.findActiveSubscriptionsForUser(subscription.userId, later)).to.be.an('array').and.empty;
    }

    // see https://github.com/gitpod-io/gitpod/issues/7171
    @test public async bug7171() {
        const paymentSourceInfo : DBPaymentSourceInfo = {
            id: "bar",
            resourceVersion: 1,
            userId: "foo",
            status: "valid",
            cardExpiryMonth: 12,
            cardExpiryYear: 2021
        };
        await this.db.storePaymentSourceInfo(paymentSourceInfo);
        const paymentSourceInfo2 : DBPaymentSourceInfo = {
            id: "bar",
            resourceVersion: 1,
            userId: "foo",
            status: "expiring",
            cardExpiryMonth: 12,
            cardExpiryYear: 2021
        };
        await this.db.storePaymentSourceInfo(paymentSourceInfo2);
    }
}

const expectExactlyOne = <T>(result: T[], expectation: T) => {
    expect(result.length).to.be.equal(1);
    expect(result[0]).to.deep.include(expectation);
}

module.exports = new AccountingDBSpec
