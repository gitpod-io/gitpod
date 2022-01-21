/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { testContainer } from '@gitpod/gitpod-db/lib/test-container';
import { TypeORM } from '@gitpod/gitpod-db/lib';
import * as chai from 'chai';
import { suite, test, timeout } from 'mocha-typescript';
import { DBSubscription } from '@gitpod/gitpod-db/lib/typeorm/entity/db-subscription';
import { SubscriptionService } from './subscription-service';
import { AccountingDB } from '@gitpod/gitpod-db/lib/accounting-db';
import { Plan } from '@gitpod/gitpod-protocol/lib/plans';
const expect = chai.expect;

@timeout(10000)
@suite
class SubscriptionServiceSpec {
  typeORM = localTestContainer.get<TypeORM>(TypeORM);
  subscriptionService = localTestContainer.get<SubscriptionService>(SubscriptionService);
  acocuntingDB = localTestContainer.get<AccountingDB>(AccountingDB);

  plan50 = <Plan>{
    name: 'Plan 50',
    chargebeeId: 'plan50',
    currency: 'USD',
    hoursPerMonth: 50,
    pricePerMonth: 50,
  };

  plan20 = <Plan>{
    name: 'Plan 20',
    chargebeeId: 'plan20',
    currency: 'USD',
    hoursPerMonth: 20,
    pricePerMonth: 20,
  };

  plan30 = <Plan>{
    name: 'Plan 30',
    chargebeeId: 'plan30',
    currency: 'USD',
    hoursPerMonth: 30,
    pricePerMonth: 30,
  };

  plan40 = <Plan>{
    name: 'Plan 40',
    chargebeeId: 'plan40',
    currency: 'USD',
    hoursPerMonth: 40,
    pricePerMonth: 40,
  };

  async before() {
    const manager = (await this.typeORM.getConnection()).manager;
    await manager.clear(DBSubscription);
  }

  @test.skip async subscriptions() {
    const start = new Date(Date.UTC(2000, 0, 1)).toISOString();
    const secondMonth = new Date(Date.UTC(2000, 1, 1)).toISOString();
    const thirdMonth = new Date(Date.UTC(2000, 2, 1)).toISOString();
    await this.subscriptionService.subscribe('Gero', this.plan50, '01', secondMonth);
    await this.subscriptionService.subscribe('Jan', this.plan20, '02', start);
    expectExactlyOne(await this.acocuntingDB.findActiveSubscriptionsForUser('Jan', start), {
      amount: 20,
      planId: 'plan20',
      paymentReference: '02',
      startDate: start,
    });
    expectExactlyOne(await this.acocuntingDB.findActiveSubscriptionsForUser('Jan', secondMonth), {
      amount: 20,
      planId: 'plan20',
      paymentReference: '02',
      startDate: start,
    });
    const subscriptionsThirdMonth = await this.acocuntingDB.findActiveSubscriptionsForUser('Jan', thirdMonth);
    expectExactlyOne(subscriptionsThirdMonth, {
      amount: 20,
      planId: 'plan20',
      paymentReference: '02',
      startDate: start,
    });

    const [{ planId: thirdMonthPlanId }] = subscriptionsThirdMonth;
    await this.subscriptionService.unsubscribe('Jan', thirdMonth, thirdMonthPlanId!);
    expectExactlyOne(await this.acocuntingDB.findActiveSubscriptionsForUser('Jan', start), {
      amount: 20,
      planId: 'plan20',
      paymentReference: '02',
      startDate: start,
    });
    expectExactlyOne(await this.acocuntingDB.findActiveSubscriptionsForUser('Jan', secondMonth), {
      amount: 20,
      planId: 'plan20',
      paymentReference: '02',
      startDate: start,
    });
    expect(await this.acocuntingDB.findActiveSubscriptionsForUser('Jan', thirdMonth)).to.be.an('array').and.empty;

    await this.subscriptionService.subscribe('Jan', this.plan30, '03', thirdMonth);
    expectExactlyOne(await this.acocuntingDB.findActiveSubscriptionsForUser('Jan', start), {
      amount: 20,
      planId: 'plan20',
      paymentReference: '02',
      startDate: start,
      endDate: thirdMonth,
    });
    expectExactlyOne(await this.acocuntingDB.findActiveSubscriptionsForUser('Jan', secondMonth), {
      amount: 20,
      planId: 'plan20',
      paymentReference: '02',
      startDate: start,
      endDate: thirdMonth,
    });
    expectExactlyOne(await this.acocuntingDB.findActiveSubscriptionsForUser('Jan', thirdMonth), {
      amount: 30,
      planId: 'plan30',
      paymentReference: '03',
      startDate: thirdMonth,
    });

    await this.subscriptionService.subscribe('Jan', this.plan40, '04', secondMonth, thirdMonth);
    expectExactlyOne(await this.acocuntingDB.findActiveSubscriptionsForUser('Jan', start), {
      amount: 20,
      planId: 'plan20',
      paymentReference: '02',
      startDate: start,
      endDate: secondMonth,
    });
    expectExactlyOne(await this.acocuntingDB.findActiveSubscriptionsForUser('Jan', secondMonth), {
      amount: 40,
      planId: 'plan40',
      paymentReference: '04',
      startDate: secondMonth,
    });
    expect(await this.acocuntingDB.findActiveSubscriptionsForUser('Jan', thirdMonth)).to.be.an('array').and.empty;

    const allSubscriptions = await this.acocuntingDB.findAllSubscriptionsForUser('Jan');
    expect(allSubscriptions.length).to.be.equal(3);
    expect(allSubscriptions[2]).to.deep.include({
      startDate: thirdMonth,
      endDate: thirdMonth,
      planId: 'plan30',
      paymentReference: '03',
      amount: 30,
    });
  }
}

const expectExactlyOne = <T>(actualSubscriptions: T[], expected: Partial<T>) => {
  expect(actualSubscriptions.length).to.equal(1);
  expect(actualSubscriptions[0]).to.deep.include(expected);
};

const localTestContainer = testContainer.createChild();
localTestContainer.bind(SubscriptionService).toSelf().inSingletonScope();

module.exports = new SubscriptionServiceSpec();
