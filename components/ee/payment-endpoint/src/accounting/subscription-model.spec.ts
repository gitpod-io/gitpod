/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { hoursLater, yearsLater } from '@gitpod/gitpod-protocol/lib/util/timeutil';
import { Subscription } from '@gitpod/gitpod-protocol/lib/accounting-protocol';
import * as chai from 'chai';
import { suite, test, only } from 'mocha-typescript';
import { SubscriptionModel } from './subscription-model';

const expect = chai.expect;

@suite
class SubscriptionModelSpec {
  @test @only mergedWithFreeSubscriptions_total_overlap() {
    const userId = '123';
    const userCreationDate = new Date(Date.UTC(2000, 0, 1)).toISOString();
    const proStartDate = hoursLater(userCreationDate, 2);
    const proOpenSourceSubscription: Subscription = {
      uid: 's1',
      userId,
      planId: 'free-open-source',
      amount: 11904,
      startDate: proStartDate,
      endDate: yearsLater(proStartDate, 1),
    };
    const cancelledPaidSubscription: Subscription = {
      uid: 's2',
      userId,
      planId: 'professional-new-eur',
      amount: 11904,
      startDate: hoursLater(userCreationDate, 3),
      cancellationDate: hoursLater(userCreationDate, 4), // one hour later
      endDate: hoursLater(userCreationDate, 4),
    };
    const model = new SubscriptionModel(userId, [proOpenSourceSubscription, cancelledPaidSubscription]);
    const blendedSubscriptions = model.mergedWithFreeSubscriptions(userCreationDate);
    const redactedBlendedSubscriptions = blendedSubscriptions.map((s) => {
      s.uid = '[...]';
      return s;
    });
    const rendered = JSON.stringify(redactedBlendedSubscriptions, null, 2);
    expect(rendered).to.be.equal(`[
  {
    "userId": "123",
    "startDate": "2001-01-01T02:00:00.000Z",
    "planId": "free",
    "amount": 100,
    "uid": "[...]"
  },
  {
    "uid": "[...]",
    "userId": "123",
    "planId": "free-open-source",
    "amount": 11904,
    "startDate": "2000-01-01T02:00:00.000Z",
    "endDate": "2001-01-01T02:00:00.000Z"
  },
  {
    "uid": "[...]",
    "userId": "123",
    "planId": "professional-new-eur",
    "amount": 11904,
    "startDate": "2000-01-01T03:00:00.000Z",
    "cancellationDate": "2000-01-01T04:00:00.000Z",
    "endDate": "2000-01-01T04:00:00.000Z"
  },
  {
    "userId": "123",
    "startDate": "2000-01-01T00:00:00.000Z",
    "planId": "free",
    "amount": 100,
    "uid": "[...]",
    "endDate": "2000-01-01T02:00:00.000Z",
    "cancellationDate": "2000-01-01T02:00:00.000Z"
  }
]`);
  }

  @test @only mergedWithFreeSubscriptions_partial_overlap() {
    const userId = '123';
    const userCreationDate = new Date(Date.UTC(2000, 0, 1)).toISOString();
    const proOpenSourceSubscription: Subscription = {
      uid: 's1',
      userId,
      planId: 'free-open-source',
      amount: 11904,
      startDate: hoursLater(userCreationDate, 2),
      endDate: hoursLater(userCreationDate, 4),
    };
    const cancelledPaidSubscription: Subscription = {
      uid: 's2',
      userId,
      planId: 'professional-new-eur',
      amount: 11904,
      startDate: hoursLater(userCreationDate, 3),
      cancellationDate: hoursLater(userCreationDate, 5),
      endDate: hoursLater(userCreationDate, 5),
    };
    const model = new SubscriptionModel(userId, [proOpenSourceSubscription, cancelledPaidSubscription]);
    const blendedSubscriptions = model.mergedWithFreeSubscriptions(userCreationDate);
    const redactedBlendedSubscriptions = blendedSubscriptions.map((s) => {
      s.uid = '[...]';
      return s;
    });
    const rendered = JSON.stringify(redactedBlendedSubscriptions, null, 2);
    expect(rendered).to.be.equal(`[
  {
    "userId": "123",
    "startDate": "2000-01-01T05:00:00.000Z",
    "planId": "free",
    "amount": 100,
    "uid": "[...]"
  },
  {
    "uid": "[...]",
    "userId": "123",
    "planId": "professional-new-eur",
    "amount": 11904,
    "startDate": "2000-01-01T03:00:00.000Z",
    "cancellationDate": "2000-01-01T05:00:00.000Z",
    "endDate": "2000-01-01T05:00:00.000Z"
  },
  {
    "uid": "[...]",
    "userId": "123",
    "planId": "free-open-source",
    "amount": 11904,
    "startDate": "2000-01-01T02:00:00.000Z",
    "endDate": "2000-01-01T04:00:00.000Z"
  },
  {
    "userId": "123",
    "startDate": "2000-01-01T00:00:00.000Z",
    "planId": "free",
    "amount": 100,
    "uid": "[...]",
    "endDate": "2000-01-01T02:00:00.000Z",
    "cancellationDate": "2000-01-01T02:00:00.000Z"
  }
]`);
  }

  @test @only mergedWithFreeSubscriptions_no_overlap() {
    const userId = '123';
    const userCreationDate = new Date(Date.UTC(2000, 0, 1)).toISOString();
    const proOpenSourceSubscription: Subscription = {
      uid: 's1',
      userId,
      planId: 'free-open-source',
      amount: 11904,
      startDate: hoursLater(userCreationDate, 2),
      endDate: hoursLater(userCreationDate, 4),
    };
    const cancelledPaidSubscription: Subscription = {
      uid: 's2',
      userId,
      planId: 'professional-new-eur',
      amount: 11904,
      startDate: hoursLater(userCreationDate, 5),
      cancellationDate: hoursLater(userCreationDate, 7),
      endDate: hoursLater(userCreationDate, 7),
    };
    const model = new SubscriptionModel(userId, [proOpenSourceSubscription, cancelledPaidSubscription]);
    const blendedSubscriptions = model.mergedWithFreeSubscriptions(userCreationDate);
    const redactedBlendedSubscriptions = blendedSubscriptions.map((s) => {
      s.uid = '[...]';
      return s;
    });
    const rendered = JSON.stringify(redactedBlendedSubscriptions, null, 2);
    expect(rendered).to.be.equal(`[
  {
    "userId": "123",
    "startDate": "2000-01-01T07:00:00.000Z",
    "planId": "free",
    "amount": 100,
    "uid": "[...]"
  },
  {
    "uid": "[...]",
    "userId": "123",
    "planId": "professional-new-eur",
    "amount": 11904,
    "startDate": "2000-01-01T05:00:00.000Z",
    "cancellationDate": "2000-01-01T07:00:00.000Z",
    "endDate": "2000-01-01T07:00:00.000Z"
  },
  {
    "userId": "123",
    "startDate": "2000-01-01T04:00:00.000Z",
    "planId": "free",
    "amount": 100,
    "uid": "[...]",
    "endDate": "2000-01-01T05:00:00.000Z",
    "cancellationDate": "2000-01-01T05:00:00.000Z"
  },
  {
    "uid": "[...]",
    "userId": "123",
    "planId": "free-open-source",
    "amount": 11904,
    "startDate": "2000-01-01T02:00:00.000Z",
    "endDate": "2000-01-01T04:00:00.000Z"
  },
  {
    "userId": "123",
    "startDate": "2000-01-01T00:00:00.000Z",
    "planId": "free",
    "amount": 100,
    "uid": "[...]",
    "endDate": "2000-01-01T02:00:00.000Z",
    "cancellationDate": "2000-01-01T02:00:00.000Z"
  }
]`);
  }
}

module.exports = new SubscriptionModelSpec();
