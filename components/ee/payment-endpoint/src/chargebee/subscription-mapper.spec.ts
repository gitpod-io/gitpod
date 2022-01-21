/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import * as chai from 'chai';
const expect = chai.expect;
import { suite, test } from 'mocha-typescript';
import * as fs from 'fs';
import * as path from 'path';

import { Chargebee as chargebee } from './chargebee-types';
import { testContainer } from '@gitpod/gitpod-db/lib/test-container';
import { Subscription } from '@gitpod/gitpod-protocol/lib/accounting-protocol';

import { SubscriptionMapperFactory, SubscriptionMapper } from './subscription-mapper';
import { Plans, ABSOLUTE_MAX_USAGE } from '@gitpod/gitpod-protocol/lib/plans';

@suite
class SubscriptionMapperSpec {
  mapperFactory = testContainer.get<SubscriptionMapperFactory>(SubscriptionMapperFactory);
  mapper: SubscriptionMapper;

  async before() {
    this.mapper = this.mapperFactory.newMapper();
  }

  @test async first_basic() {
    const userCreatedDate = new Date('2018-11-24T04:05:48.000Z').toISOString();
    const events = loadFromFolder<chargebee.SubscriptionEventV2>('first_basic');

    let subscriptions: Subscription[] = [];

    const basicCreated = events.get('basic-created')!;
    const model = this.mapper.map(filterFree(subscriptions), basicCreated);
    subscriptions = model.mergedWithFreeSubscriptions(userCreatedDate);

    expect(filterIrrelevantFields(subscriptions)).to.deep.equal([
      {
        userId: '68b75ca3-df45-4fde-8665-9f9f3d749d55',
        startDate: '2018-11-29T12:01:09.000Z',
        amount: 100,
        planId: 'basic-usd',
        paymentReference: 'Hr55127RAn4dqQ1e7x',
      },
      {
        userId: '68b75ca3-df45-4fde-8665-9f9f3d749d55',
        startDate: '2018-11-24T04:05:48.000Z',
        endDate: '2018-11-29T12:01:09.000Z',
        amount: 100,
        planId: 'free',
        cancellationDate: '2018-11-29T12:01:09.000Z',
      },
    ]);
  }

  @test async full_cycle() {
    const userCreatedDate = new Date('2018-11-20T15:25:48.000Z').toISOString();
    const events = loadFromFolder<chargebee.SubscriptionEventV2>('full_cycle');

    let subscriptions: Subscription[] = [];

    const basicCreated = events.get('basic-created')!;
    let model = this.mapper.map(filterFree(subscriptions), basicCreated);
    subscriptions = model.mergedWithFreeSubscriptions(userCreatedDate);

    expect(filterIrrelevantFields(subscriptions), 'basic-created').to.deep.equal([
      {
        userId: '31376076-3362-4faa-9012-01ee684b73ff',
        startDate: '2018-11-27T15:25:48.000Z',
        planId: 'basic-usd',
        amount: 100,
        paymentReference: 'Hr5511ERAcD8VHCmF',
      },
      {
        userId: '31376076-3362-4faa-9012-01ee684b73ff',
        planId: 'free',
        amount: 100,
        startDate: '2018-11-20T15:25:48.000Z',
        endDate: '2018-11-27T15:25:48.000Z',
        cancellationDate: '2018-11-27T15:25:48.000Z',
      },
    ]);

    const upgradeToPro = events.get('upgrade-to-pro')!;
    model = this.mapper.map(filterFree(subscriptions), upgradeToPro);
    subscriptions = model.mergedWithFreeSubscriptions(userCreatedDate);

    expect(filterIrrelevantFields(subscriptions), 'upgrade-to-pro').to.deep.equal([
      {
        userId: '31376076-3362-4faa-9012-01ee684b73ff',
        startDate: '2018-11-27T15:25:48.000Z',
        planId: 'professional-usd',
        amount: ABSOLUTE_MAX_USAGE,
        paymentReference: 'Hr5511ERAcD8VHCmF',
      },
      {
        userId: '31376076-3362-4faa-9012-01ee684b73ff',
        planId: 'free',
        amount: 100,
        startDate: '2018-11-20T15:25:48.000Z',
        endDate: '2018-11-27T15:25:48.000Z',
        cancellationDate: '2018-11-27T15:25:48.000Z',
      },
    ]);

    const proCancelled = events.get('pro-cancelled')!;
    model = this.mapper.map(filterFree(subscriptions), proCancelled);
    subscriptions = model.mergedWithFreeSubscriptions(userCreatedDate);

    expect(filterIrrelevantFields(subscriptions), 'pro-cancelled').to.deep.equal([
      {
        userId: '31376076-3362-4faa-9012-01ee684b73ff',
        startDate: '2018-12-27T15:25:48.000Z',
        planId: 'free',
        amount: 100,
      },
      {
        userId: '31376076-3362-4faa-9012-01ee684b73ff',
        startDate: '2018-11-27T15:25:48.000Z',
        planId: 'professional-usd',
        amount: ABSOLUTE_MAX_USAGE,
        paymentReference: 'Hr5511ERAcD8VHCmF',
        endDate: '2018-12-27T15:25:48.000Z',
        cancellationDate: '2018-11-27T15:56:23.000Z',
      },
      {
        userId: '31376076-3362-4faa-9012-01ee684b73ff',
        planId: 'free',
        amount: 100,
        startDate: '2018-11-20T15:25:48.000Z',
        endDate: '2018-11-27T15:25:48.000Z',
        cancellationDate: '2018-11-27T15:25:48.000Z',
      },
    ]);

    const proReactivated = events.get('pro-reactivated')!;
    model = this.mapper.map(filterFree(subscriptions), proReactivated);
    subscriptions = model.mergedWithFreeSubscriptions(userCreatedDate);

    expect(filterIrrelevantFields(subscriptions), 'pro-reactivated').to.deep.equal([
      {
        amount: ABSOLUTE_MAX_USAGE,
        paymentReference: 'Hr5511ERAcD8VHCmF',
        planId: 'professional-usd',
        startDate: '2018-11-27T15:25:48.000Z',
        userId: '31376076-3362-4faa-9012-01ee684b73ff',
      },
      {
        userId: '31376076-3362-4faa-9012-01ee684b73ff',
        startDate: '2018-11-27T15:25:48.000Z',
        planId: 'professional-usd',
        amount: ABSOLUTE_MAX_USAGE,
        paymentReference: 'Hr5511ERAcD8VHCmF',
        endDate: '2018-12-27T15:25:48.000Z',
        cancellationDate: '2018-11-27T15:56:23.000Z',
      },
      {
        userId: '31376076-3362-4faa-9012-01ee684b73ff',
        planId: 'free',
        amount: 100,
        startDate: '2018-11-20T15:25:48.000Z',
        endDate: '2018-11-27T15:25:48.000Z',
        cancellationDate: '2018-11-27T15:25:48.000Z',
      },
    ]);

    const downgradeToBasic = events.get('downgrade-to-basic')!;
    model = this.mapper.map(filterFree(subscriptions), downgradeToBasic);
    subscriptions = model.mergedWithFreeSubscriptions(userCreatedDate);

    expect(filterIrrelevantFields(subscriptions), 'downgrade-to-basic').to.deep.equal([
      {
        amount: ABSOLUTE_MAX_USAGE,
        paymentReference: 'Hr5511ERAcD8VHCmF',
        planId: 'professional-usd',
        startDate: '2018-11-27T15:25:48.000Z',
        userId: '31376076-3362-4faa-9012-01ee684b73ff',
      },
      {
        userId: '31376076-3362-4faa-9012-01ee684b73ff',
        startDate: '2018-11-27T15:25:48.000Z',
        planId: 'professional-usd',
        amount: ABSOLUTE_MAX_USAGE,
        paymentReference: 'Hr5511ERAcD8VHCmF',
        endDate: '2018-12-27T15:25:48.000Z',
        cancellationDate: '2018-11-27T15:56:23.000Z',
      },
      {
        userId: '31376076-3362-4faa-9012-01ee684b73ff',
        planId: 'free',
        amount: 100,
        startDate: '2018-11-20T15:25:48.000Z',
        endDate: '2018-11-27T15:25:48.000Z',
        cancellationDate: '2018-11-27T15:25:48.000Z',
      },
    ]);
  }

  @test async downgrade_unlimited_to_professional_new() {
    const userCreatedDate = new Date('2018-11-20T15:25:48.000Z').toISOString();
    const events = loadFromFolder<chargebee.SubscriptionEventV2>('downgrade_unlimited_to_professional_new');

    let subscriptions: Subscription[] = [
      {
        userId: '643ac637-74ae-4f82-9a86-c8527eb1e496',
        startDate: '2018-11-20T15:25:48.000Z',
        endDate: '2019-04-07T13:17:58.000Z',
        cancellationDate: '2019-04-07T13:17:58.000Z',
        amount: 100,
        uid: '7f76687f-8b09-482b-b059-5779e51c3a44',
        planId: 'free',
      },
      {
        userId: '643ac637-74ae-4f82-9a86-c8527eb1e496',
        startDate: '2019-04-07T13:17:58.000Z',
        amount: 5952,
        uid: '7f76687f-8b09-482b-b059-5779e51c3a22',
        planId: 'professional-eur',
        paymentReference: '1mkVvmiRMxfTZj1JGs',
        paymentData: {
          downgradeDate: '2020-01-07T13:17:58.000Z',
        },
      },
    ];

    const basicCreated = events.get('downgrade-change-actual')!;
    let model = this.mapper.map(filterFree(subscriptions), basicCreated);
    subscriptions = model.mergedWithFreeSubscriptions(userCreatedDate);

    expect(filterIrrelevantFields(subscriptions), 'downgrade-change-actual').to.deep.equal([
      {
        userId: '643ac637-74ae-4f82-9a86-c8527eb1e496',
        startDate: '2020-01-07T13:17:58.000Z',
        amount: 11904,
        planId: 'professional-new-eur',
        paymentReference: '1mkVvmiRMxfTZj1JGs',
      },
      {
        userId: '643ac637-74ae-4f82-9a86-c8527eb1e496',
        startDate: '2019-04-07T13:17:58.000Z',
        endDate: '2020-01-07T13:17:58.000Z',
        cancellationDate: '2020-01-07T13:17:58.000Z',
        amount: 5952,
        planId: 'professional-eur',
        paymentReference: '1mkVvmiRMxfTZj1JGs',
        paymentData: {
          downgradeDate: '2020-01-07T13:17:58.000Z',
        },
      },
      {
        userId: '643ac637-74ae-4f82-9a86-c8527eb1e496',
        startDate: '2018-11-20T15:25:48.000Z',
        endDate: '2019-04-07T13:17:58.000Z',
        amount: 100,
        planId: 'free',
        cancellationDate: '2019-04-07T13:17:58.000Z',
      },
    ]);
  }
}

const filterFree = (subscriptions: Subscription[]): Subscription[] => {
  return subscriptions.filter(
    (s) =>
      s.planId !== Plans.FREE.chargebeeId &&
      s.planId !== Plans.FREE_50.chargebeeId &&
      s.planId !== Plans.FREE_OPEN_SOURCE.chargebeeId,
  );
};

const filterIrrelevantFields = (subscriptions: Subscription[]): Subscription[] => {
  return subscriptions.map((s) => {
    const r = { ...s };
    delete (r as any).uid;
    return r;
  });
};

/**
 * Loads events from a folder, each being a json file with the name format:
 * <number>.<name>.[....]
 * Where number is used for sorting only but name also for referencing
 * @param testname Name of the folder containing the event json files
 */
const loadFromFolder = <T>(testname: string): Map<string, chargebee.Event<T>> => {
  const events: Map<string, chargebee.Event<T>> = new Map();
  const testBasePath = path.join(__dirname, '../../test/fixtures/', testname);
  const files = fs.readdirSync(testBasePath).sort();
  for (const file of files) {
    const content = fs.readFileSync(path.join(testBasePath, file));
    const fileParts = file.split('.');
    if (fileParts.length < 2) {
      throw new Error('Expected file name of the format <number>.<name>.[...]');
    }
    const name = fileParts[1];
    events.set(name, JSON.parse(content.toString()));
  }
  return events;
};

testContainer
  .bind(SubscriptionMapperFactory)
  .toDynamicValue((ctx) => {
    return {
      newMapper: () => {
        return new SubscriptionMapper();
      },
    };
  })
  .inSingletonScope();
module.exports = new SubscriptionMapperSpec();
