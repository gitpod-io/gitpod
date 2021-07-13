/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { testContainer } from '@gitpod/gitpod-db/lib/test-container';
import { hoursLater, rightBefore, rightAfter, oneMonthLater } from '@gitpod/gitpod-protocol/lib/util/timeutil';
import { DBWorkspace, DBWorkspaceInstance, WorkspaceDB, UserDB, DBUser, DBIdentity } from '@gitpod/gitpod-db/lib';
import { DBAccountEntry } from '@gitpod/gitpod-db/lib/typeorm/entity/db-account-entry';
import { TypeORM } from '@gitpod/gitpod-db/lib/typeorm/typeorm';
import { AccountEntry, Subscription, AccountStatement } from '@gitpod/gitpod-protocol/lib/accounting-protocol';
import { Plans, ABSOLUTE_MAX_USAGE, Plan } from '@gitpod/gitpod-protocol/lib/plans';
import * as chai from 'chai';
import { suite, test, timeout } from 'mocha-typescript';
import { AccountService } from './account-service';
import { AccountServiceImpl } from './account-service-impl';
import { DBSubscription } from '@gitpod/gitpod-db/lib/typeorm/entity/db-subscription';
import { AccountingDB } from '@gitpod/gitpod-db/lib/accounting-db';
import { AccountingServer } from './accounting-server';
import { SubscriptionService } from './subscription-service';

const expect = chai.expect;

const start = new Date(Date.UTC(2000, 0, 1)).toISOString();
const secondDay = new Date(Date.UTC(2000, 0, 2)).toISOString();
const secondMonth = new Date(Date.UTC(2000, 1, 1)).toISOString();
const end = new Date(Date.UTC(2000, 2, 1)).toISOString();

@timeout(10000)
@suite class AccountServiceSpec {
    typeORM = localTestContainer.get<TypeORM>(TypeORM);
    accountService = localTestContainer.get<AccountService>(AccountService);
    accountingDb = localTestContainer.get<AccountingDB>(AccountingDB);
    workspaceDb = localTestContainer.get<WorkspaceDB>(WorkspaceDB);
    userDb = localTestContainer.get<UserDB>(UserDB);

    subscription: Subscription

    @timeout(10000)
    async before() {
        await this.setupPurgeDB();
        await this.setupUserAndWs();

        this.subscription = await this.accountingDb.newSubscription({
            userId: 'Sven',
            startDate: start,
            amount: 100,
            planId: 'test'
        });
    }

    protected async setupPurgeDB() {
        const manager = (await this.typeORM.getConnection()).manager;
        await manager.clear(DBWorkspaceInstance)
        await manager.clear(DBAccountEntry)
        await manager.clear(DBSubscription)
        await manager.clear(DBWorkspace)
        manager.query('SET FOREIGN_KEY_CHECKS = 0;');
        await manager.clear(DBIdentity);
        await manager.clear(DBUser);
        manager.query('SET FOREIGN_KEY_CHECKS = 1;');
    }

    protected async setupUserAndWs() {
        await this.userDb.storeUser({
            id: 'Sven',
            creationDate: start,
            fullName: 'Sven',
            allowsMarketingCommunication: false,
            identities: [{
                authProviderId: 'github.com',
                authId: 'Sven',
                authName: 'Sven',
                tokens: []
            }]
        });
        await this.workspaceDb.store({
            id: '1',
            ownerId: 'Sven',
            contextURL: '',
            creationTime: start,
            config: { ports: [], tasks: [], image: '' },
            context: { title: '' },
            description: 'test ws',
            type: 'regular'
        });
    }

    @test async testIssue4045Minimal() {
        // We want a clean state
        await this.setupPurgeDB();
        await this.setupUserAndWs();

        // The following is a bug where we did not calculate the current remainingHours properly.
        // In case someone cancelled two subscriptions (with equal hours) + regular usage within on month time frame
        // they would run out of hours, regardless of having an unlimited plan.
        const subscription = async (plan: Plan, startDate: string, endDate?: string) => {
            const s = await this.accountingDb.newSubscription({
                userId: 'Sven',
                startDate,
                amount: Plans.getHoursPerMonth(plan),
                paymentReference: 'plan',
                endDate,
                planId: plan.chargebeeId
            });
            await this.accountingDb.storeSubscription(s);
        };

        // Start with two subscriptions, each cancelled shortly after creation (making them end oneMonthLater)
        const s1Start = start;
        const s1End = oneMonthLater(s1Start);
        await subscription(Plans.PROFESSIONAL_EUR, s1Start, s1End);

        const s2Start = hoursLater(s1Start, 2);
        await subscription(Plans.PROFESSIONAL_EUR, s2Start, oneMonthLater(s2Start));

        // Start a 3rd subscription with the same amount of hours shortly after which is still running
        const s3Start = hoursLater(s1Start, 3);
        await subscription(Plans.PROFESSIONAL_NEW_EUR, s3Start);

        // Have a bit of usage at the start of the 1st subscription
        await this.createSession(s1Start, 3);

        // Shortly after the the 3rd subscription started we should have "3-times unlimited", not zero
        const remainingHours = await this.remainingHours(hoursLater(s3Start, 8));
        expect(remainingHours).to.be.equal(ABSOLUTE_MAX_USAGE);
    }

    @test
     async testRemainingHoursUnlimited() {
        // We want a clean state
        await this.setupPurgeDB();
        await this.setupUserAndWs();

        const basic = Plans.BASIC_EUR;
        this.subscription = await this.accountingDb.newSubscription({
            userId: 'Sven',
            startDate: start,
            amount: Plans.getHoursPerMonth(basic),
            paymentReference: 'mine-basic',
            planId: basic.chargebeeId
        });
        await this.accountingDb.storeSubscription(this.subscription);

        const subscriptionSwitchDate = hoursLater(start, 1);
        Subscription.cancelSubscription(this.subscription, subscriptionSwitchDate);
        await this.accountingDb.storeSubscription(this.subscription);

        const p2 = Plans.PROFESSIONAL_EUR;
        const proSusbcription = await this.accountingDb.newSubscription({
            userId: 'Sven',
            startDate: subscriptionSwitchDate,
            amount: Plans.getHoursPerMonth(p2),
            paymentReference: 'mine-pro',
            planId: p2.chargebeeId
        });
        await this.accountingDb.storeSubscription(proSusbcription);

        const statementDate = hoursLater(start, 2);
        const statement = await this.accountService.getAccountStatement('Sven', statementDate);
        expect(statement!.remainingHours).to.be.equal("unlimited");
        const remainingUsageHours = this.accountService.getRemainingUsageHours(statement, 1);
        expect(remainingUsageHours).to.be.equal(ABSOLUTE_MAX_USAGE);
    }

    @test async testRemainingHours() {
        const subscriptionSwitchDate = hoursLater(start, 10 * 24);  // 10 days
        Subscription.cancelSubscription(this.subscription, subscriptionSwitchDate);
        await this.accountingDb.storeSubscription(this.subscription);

        const insertCancelledSubscription = async (startDate: string) => {
            await this.accountingDb.storeSubscription(await this.accountingDb.newSubscription({
                userId: 'Sven',
                startDate: startDate,
                cancellationDate: hoursLater(startDate, 1),
                endDate: oneMonthLater(startDate),
                amount: 200,
                planId: 'test'
            }));
        };
        await insertCancelledSubscription(hoursLater(subscriptionSwitchDate, 1));
        await insertCancelledSubscription(hoursLater(subscriptionSwitchDate, 2));
        await insertCancelledSubscription(hoursLater(subscriptionSwitchDate, 3));
        await insertCancelledSubscription(hoursLater(subscriptionSwitchDate, 4));

        const statement = await this.accountService.getAccountStatement('Sven', hoursLater(subscriptionSwitchDate, 5));
        expect(statement!.remainingHours).to.be.equal(800);
    }

    @test async noSessions() {
        expect(await this.invoice(start)).to.be.equal('')
        expect(await this.invoice(rightAfter(start))).to.be.equal('2000-01-01T00:00:00.000Z 100 credit 100')
        expect(await this.invoice(rightBefore(secondMonth))).to.be.equal('2000-01-01T00:00:00.000Z 100 credit 100');
        expect(await this.invoice(secondMonth)).to.be.equal(
`2000-01-01T00:00:00.000Z 100 credit 0
2000-01-31T23:59:59.999Z -100 expiry`)
        expect(await this.invoice(rightAfter(secondMonth))).to.be.equal(
`2000-01-01T00:00:00.000Z 100 credit 0
2000-01-31T23:59:59.999Z -100 expiry
2000-02-01T00:00:00.000Z 100 credit 100`)
    }

    @test async singleSession() {
        await this.createSession(start, 30);
        expect(await this.invoice(hoursLater(start, 1))).to.be.equal(
`2000-01-01T00:00:00.000Z 100 credit 99
2000-01-01T00:59:59.999Z -1 session`);
        expect(await this.invoice(hoursLater(start, 31))).to.be.equal(
`2000-01-01T00:00:00.000Z 100 credit 70
2000-01-02T06:00:00.000Z -30 session`)
        expect(await this.invoice(rightBefore(secondMonth))).to.be.equal(
`2000-01-01T00:00:00.000Z 100 credit 70
2000-01-02T06:00:00.000Z -30 session`);
        expect(await this.invoice(secondMonth)).to.be.equal(
`2000-01-01T00:00:00.000Z 100 credit 0
2000-01-02T06:00:00.000Z -30 session
2000-01-31T23:59:59.999Z -70 expiry`)
        expect(await this.invoice(rightAfter(secondMonth))).to.be.equal(
`2000-01-01T00:00:00.000Z 100 credit 0
2000-01-02T06:00:00.000Z -30 session
2000-01-31T23:59:59.999Z -70 expiry
2000-02-01T00:00:00.000Z 100 credit 100`)
    }

    @test async twoOverlappingSessions() {
        await this.createSession(start, 30);
        await this.createSession(secondDay, 20);
        expect(await this.invoice(hoursLater(secondDay, 1))).to.be.equal(
`2000-01-01T00:00:00.000Z 100 credit 74
2000-01-02T00:59:59.999Z -25 session
2000-01-02T00:59:59.999Z -1 session`)
        expect(await this.invoice(hoursLater(secondDay, 21))).to.be.equal(
`2000-01-01T00:00:00.000Z 100 credit 50
2000-01-02T06:00:00.000Z -30 session
2000-01-02T20:00:00.000Z -20 session`)
    }

    @test async rightBeforeEndOfMonth() {
        await this.createSession(rightBefore(secondMonth), -10);
        expect(await this.invoice(secondMonth)).to.be.equal(
`2000-01-01T00:00:00.000Z 100 credit 0
2000-01-31T23:59:59.999Z -10 session
2000-01-31T23:59:59.999Z -90 expiry`);
        expect(await this.invoice(end)).to.be.equal(
`2000-01-01T00:00:00.000Z 100 credit 0
2000-01-31T23:59:59.999Z -10 session
2000-01-31T23:59:59.999Z -90 expiry
2000-02-01T00:00:00.000Z 100 credit 0
2000-02-29T23:59:59.999Z -100 expiry`);
    }

    @test async overbooking() {
        await this.createSession(start, 120);
        expect(await this.invoice(end)).to.be.equal(
`2000-01-01T00:00:00.000Z 100 credit 0
2000-01-06T00:00:00.000Z -100 session
2000-01-06T00:00:00.000Z 20 loss
2000-02-01T00:00:00.000Z 100 credit 0
2000-02-29T23:59:59.999Z -100 expiry`);
    }

    @test async multiPeriodSession() {
        await this.createSession(hoursLater(secondMonth, -15), 20);
        expect(await this.invoice(rightBefore(end))).to.be.equal(
`2000-01-01T00:00:00.000Z 100 credit 0
2000-01-31T23:59:59.999Z -15 session
2000-01-31T23:59:59.999Z -85 expiry
2000-02-01T00:00:00.000Z 100 credit 95
2000-02-01T05:00:00.000Z -5 session`);
    }

    @test async multiCredit() {
        await this.accountingDb.newAccountEntry({
            userId: 'Sven',
            amount: 10,
            date: hoursLater(start, 48),
            kind: 'credit',
            expiryDate: hoursLater(secondMonth, 48)
        })
        await this.accountingDb.newAccountEntry({
            userId: 'Sven',
            amount: 20,
            date: hoursLater(start, 24),
            kind: 'credit',
            expiryDate: hoursLater(start, 72)
        })
        expect(await this.invoice(end)).to.be.equal(
`2000-01-01T00:00:00.000Z 100 credit 0
2000-01-02T00:00:00.000Z 20 open 0
2000-01-03T00:00:00.000Z 10 open 0
2000-01-03T23:59:59.999Z -20 expiry
2000-01-31T23:59:59.999Z -100 expiry
2000-02-01T00:00:00.000Z 100 credit 0
2000-02-02T23:59:59.999Z -10 expiry
2000-02-29T23:59:59.999Z -100 expiry`);
    }

@test async multiCreditSessionBefore() {
    await this.accountingDb.newAccountEntry({
        userId: 'Sven',
        amount: 20,
        date: hoursLater(start, 24),
        kind: 'credit',
        expiryDate: hoursLater(secondMonth, 24)
    })
    await this.createSession(start, 10);
    expect(await this.invoice(end)).to.be.equal(
`2000-01-01T00:00:00.000Z 100 credit 0
2000-01-01T10:00:00.000Z -10 session
2000-01-02T00:00:00.000Z 20 open 0
2000-01-31T23:59:59.999Z -90 expiry
2000-02-01T00:00:00.000Z 100 credit 0
2000-02-01T23:59:59.999Z -20 expiry
2000-02-29T23:59:59.999Z -100 expiry`);
    }

    @test async multiCreditSessionAfter() {
        await this.accountingDb.newAccountEntry({
            userId: 'Sven',
            amount: 20,
            date: hoursLater(start, 24),
            kind: 'credit',
            expiryDate: hoursLater(start, 48)
        })
        await this.createSession(hoursLater(start, 48), 10);
        expect(await this.invoice(end)).to.be.equal(
`2000-01-01T00:00:00.000Z 100 credit 0
2000-01-02T00:00:00.000Z 20 open 0
2000-01-02T23:59:59.999Z -20 expiry
2000-01-03T10:00:00.000Z -10 session
2000-01-31T23:59:59.999Z -90 expiry
2000-02-01T00:00:00.000Z 100 credit 0
2000-02-29T23:59:59.999Z -100 expiry`);
        }

    @test async multiCreditSessionOverlap() {
        await this.accountingDb.newAccountEntry({
            userId: 'Sven',
            amount: 20,
            date: hoursLater(start, 24),
            kind: 'credit',
            expiryDate: hoursLater(secondMonth, 24)
        })
        await this.createSession(start, 48);
        expect(await this.invoice(end)).to.be.equal(
`2000-01-01T00:00:00.000Z 100 credit 0
2000-01-02T00:00:00.000Z 20 open 0
2000-01-03T00:00:00.000Z -48 session
2000-01-31T23:59:59.999Z -52 expiry
2000-02-01T00:00:00.000Z 100 credit 0
2000-02-01T23:59:59.999Z -20 expiry
2000-02-29T23:59:59.999Z -100 expiry`);
    }

    @test async multiCreditSessionOverlap_1() {
        await this.accountingDb.newAccountEntry({
            userId: 'Sven',
            amount: 20,
            date: hoursLater(start, 24),
            kind: 'credit',
            expiryDate: hoursLater(start, 72)
        })
        await this.accountingDb.newAccountEntry({
            userId: 'Sven',
            amount: 10,
            date: hoursLater(start, 48),
            kind: 'credit',
            expiryDate: hoursLater(secondMonth, 48)
        })
        await this.createSession(hoursLater(start, 12), 40);
        expect(await this.invoice(end)).to.be.equal(
`2000-01-01T00:00:00.000Z 100 credit 0
2000-01-01T23:59:59.999Z -12 session
2000-01-02T00:00:00.000Z 20 open 0
2000-01-03T00:00:00.000Z 10 open 0
2000-01-03T04:00:00.000Z -20 session
2000-01-03T04:00:00.000Z -8 session
2000-01-31T23:59:59.999Z -80 expiry
2000-02-01T00:00:00.000Z 100 credit 0
2000-02-02T23:59:59.999Z -10 expiry
2000-02-29T23:59:59.999Z -100 expiry`);
    }

    @test async multiSubscription() {
        const subscriptionSwitchDate = hoursLater(start, 10 * 24); // 10 days
        Subscription.cancelSubscription(this.subscription, subscriptionSwitchDate, oneMonthLater(this.subscription.startDate));
        await this.accountingDb.storeSubscription(this.subscription);
        await this.accountingDb.storeSubscription(await this.accountingDb.newSubscription({
            userId: 'Sven',
            startDate: subscriptionSwitchDate,
            amount: 200,
            planId: 'test'
        }));
        expect(await this.invoice(end)).to.be.equal(
`2000-01-01T00:00:00.000Z 100 credit 0
2000-01-11T00:00:00.000Z 200 credit 0
2000-01-31T23:59:59.999Z -100 expiry
2000-02-10T23:59:59.999Z -200 expiry
2000-02-11T00:00:00.000Z 200 credit 200`);
    }

    @test async multiSubscriptionOverlappingSession() {
        const subscriptionSwitchDate = hoursLater(start, 240);
        Subscription.cancelSubscription(this.subscription, subscriptionSwitchDate, oneMonthLater(this.subscription.startDate));
        await this.accountingDb.storeSubscription(this.subscription)
        await this.accountingDb.storeSubscription(await this.accountingDb.newSubscription({
            userId: 'Sven',
            startDate: subscriptionSwitchDate,
            amount: 200,
            planId: 'test'
        }));
        await this.createSession(hoursLater(start, 230), 20)
        expect(await this.invoice(end)).to.be.equal(
`2000-01-01T00:00:00.000Z 100 credit 0
2000-01-11T00:00:00.000Z 200 credit 0
2000-01-11T10:00:00.000Z -20 session
2000-01-31T23:59:59.999Z -80 expiry
2000-02-10T23:59:59.999Z -200 expiry
2000-02-11T00:00:00.000Z 200 credit 200`);
    }

    @test async multiSubscriptionOverlappingSessions() {
        const subscriptionSwitchDate = hoursLater(start, 240);
        Subscription.cancelSubscription(this.subscription, subscriptionSwitchDate, oneMonthLater(this.subscription.startDate));
        await this.accountingDb.storeSubscription(this.subscription)
        await this.accountingDb.storeSubscription(await this.accountingDb.newSubscription({
            userId: 'Sven',
            startDate: subscriptionSwitchDate,
            amount: 200,
            planId: 'test'
        }));
        await this.createSession(hoursLater(start, 230), 20)
        await this.createSession(hoursLater(start, 220), 30)
        expect(await this.invoice(end)).to.be.equal(
`2000-01-01T00:00:00.000Z 100 credit 0
2000-01-11T00:00:00.000Z 200 credit 0
2000-01-11T10:00:00.000Z -30 session
2000-01-11T10:00:00.000Z -20 session
2000-01-31T23:59:59.999Z -50 expiry
2000-02-10T23:59:59.999Z -200 expiry
2000-02-11T00:00:00.000Z 200 credit 200`);
    }

    @test async multiSubscriptionOverlappingSession_2() {
        const subscriptionSwitchDate1 = hoursLater(start, 240);
        const subscriptionSwitchDate2 = hoursLater(start, 245);
        Subscription.cancelSubscription(this.subscription, subscriptionSwitchDate1, oneMonthLater(this.subscription.startDate));
        await this.accountingDb.storeSubscription(this.subscription)
        const subscription2 = await this.accountingDb.newSubscription({
            userId: 'Sven',
            startDate: subscriptionSwitchDate1,
            amount: 200,
            planId: 'test'
        });
        Subscription.cancelSubscription(subscription2, subscriptionSwitchDate2, oneMonthLater(subscription2.startDate));
        await this.accountingDb.storeSubscription(subscription2);
        await this.accountingDb.storeSubscription(await this.accountingDb.newSubscription({
            userId: 'Sven',
            startDate: subscriptionSwitchDate2,
            amount: 300,
            planId: 'test'
        }));
        await this.createSession(hoursLater(start, 230), 20)
        expect(await this.invoice(end)).to.be.equal(
`2000-01-01T00:00:00.000Z 100 credit 0
2000-01-11T00:00:00.000Z 200 credit 0
2000-01-11T05:00:00.000Z 300 credit 0
2000-01-11T10:00:00.000Z -20 session
2000-01-31T23:59:59.999Z -80 expiry
2000-02-10T23:59:59.999Z -200 expiry
2000-02-11T04:59:59.999Z -300 expiry
2000-02-11T05:00:00.000Z 300 credit 300`);
    }

    @test async remainingHoursNoSession() {
        expect(await this.remainingHours(rightAfter(start))).to.be.equal(100);
        expect(await this.remainingHours(rightAfter(secondMonth))).to.be.equal(100);
        expect(await this.remainingHours(hoursLater(secondMonth, -10), 1, true)).to.be.equal(110);
        expect(await this.remainingHours(hoursLater(secondMonth, -10), 1, false)).to.be.equal(100);
        expect(await this.remainingHours(hoursLater(secondMonth, -100), 1, true)).to.be.equal(200);
        expect(await this.remainingHours(hoursLater(secondMonth, -100), 1, false)).to.be.equal(100);
        expect(await this.remainingHours(hoursLater(secondMonth, -101), 1, true)).to.be.equal(100);

        expect(await this.remainingHours(rightAfter(start), 2)).to.be.equal(50);
        expect(await this.remainingHours(hoursLater(secondMonth, -51), 2)).to.be.equal(50);
    }

    @test async remainingHoursOneSession() {
        await this.createSession(start, 100);
        expect(await this.remainingHours(rightAfter(start))).to.be.equal(99.99999972222221);
        expect(await this.remainingHours(rightAfter(secondMonth))).to.be.equal(100);
        expect(await this.remainingHours(hoursLater(start, 50))).to.be.equal(50);
        expect(await this.remainingHours(hoursLater(start, 100))).to.be.equal(0);
    }

    @test async remainingHoursTwoSubscriptions() {
        Subscription.cancelSubscription(this.subscription, secondMonth);
        await this.accountingDb.storeSubscription(this.subscription)
        await this.accountingDb.storeSubscription(await this.accountingDb.newSubscription({
            userId: 'Sven',
            startDate: secondMonth,
            amount: 200,
            planId: 'test'
        }));
        expect(await this.remainingHours(rightAfter(start))).to.be.equal(100);
        expect(await this.remainingHours(rightAfter(secondMonth))).to.be.equal(200);
    }

    @test async creditsAreOnlyBookedAgainstLaterSessions() {
        // use more than subscription has
        await this.createSession(hoursLater(start, 12), 110);
        // add a credit afterwards
        await this.accountingDb.newAccountEntry({
            userId: 'Sven',
            amount: 10,
            date: hoursLater(start, 200),
            kind: 'credit'
        });
        // before the credit the balance should be 0 (i.e. +10 free)
        expect(await this.remainingHours(hoursLater(start, 199))).to.be.equal(0);
        // afterwards the 10 should be added and not used against previous sessions
        expect(await this.remainingHours(hoursLater(start, 200))).to.be.equal(10);
    }

    @test async creditsAreBookedAgainstSessionsByAge() {
        const subscriptionWith40Hours = {
            ...this.subscription,
            amount: 40
        };
        await this.accountingDb.storeSubscription(await this.accountingDb.newSubscription(subscriptionWith40Hours));
        await this.createSession(hoursLater(start, 30), 30)
        await this.createSession(hoursLater(start, 60), 60)
        await this.createSession(hoursLater(start, 20), 20)
        await this.createSession(hoursLater(start, 50), 50)
        await this.createSession(hoursLater(start, 10), 10)
        await this.createSession(hoursLater(start, 40), 40)
        const expectation = await this.invoice(end);
        expect(expectation).to.be.equal(
`2000-01-01T00:00:00.000Z 40 credit 0
2000-01-01T20:00:00.000Z -10 session
2000-01-02T16:00:00.000Z -20 session
2000-01-03T12:00:00.000Z -10 session
2000-01-03T12:00:00.000Z 20 loss
2000-01-04T08:00:00.000Z 40 loss
2000-01-05T04:00:00.000Z 50 loss
2000-01-06T00:00:00.000Z 60 loss
2000-02-01T00:00:00.000Z 40 credit 0
2000-02-29T23:59:59.999Z -40 expiry`);
    }

    // Test for https://github.com/TypeFox/gitpod/pull/3797#issuecomment-588170598
    @test async testPaidPlanWhileProOpenSource() {
        Subscription.cancelSubscription(this.subscription, hoursLater(start, 1), oneMonthLater(this.subscription.startDate));
        await this.accountingDb.storeSubscription(this.subscription)
        await this.accountingDb.storeSubscription(await this.accountingDb.newSubscription({
            userId: 'Sven',
            planId: 'free-open-source',
            amount: 11904,
            startDate: hoursLater(start, 2),
            endDate: hoursLater(start, 2 + 365.25 * 24), // one year later
        }));
        await this.accountingDb.storeSubscription(await this.accountingDb.newSubscription({
            userId: 'Sven',
            planId: 'professional-new-eur',
            amount: 11904,
            startDate: hoursLater(start, 3),
            cancellationDate: hoursLater(start, 4), // one hour later
            endDate: hoursLater(start, 4),
        }));
        let statement = await this.accountService.getAccountStatement('Sven', hoursLater(start, 5));
        const redactedCredits = statement!.credits.map(c => {
            (c.description as any).subscriptionId = '[...]';
            c.uid = '[...]';
            return c;
        })
        expect(JSON.stringify(redactedCredits, null, 4)).to.be.equal(`[
    {
        "userId": "Sven",
        "amount": 11904,
        "remainingAmount": 11904,
        "date": "2000-01-01T02:00:00.000Z",
        "expiryDate": "2000-02-01T02:00:00.000Z",
        "kind": "credit",
        "description": {
            "subscriptionId": "[...]",
            "planId": "free-open-source"
        },
        "uid": "[...]"
    },
    {
        "userId": "Sven",
        "amount": 100,
        "remainingAmount": 100,
        "date": "2000-01-01T00:00:00.000Z",
        "expiryDate": "2000-02-01T00:00:00.000Z",
        "kind": "credit",
        "description": {
            "subscriptionId": "[...]",
            "planId": "test"
        },
        "uid": "[...]"
    },
    {
        "userId": "Sven",
        "amount": 11904,
        "remainingAmount": 0,
        "date": "2000-01-01T03:00:00.000Z",
        "expiryDate": "2000-01-01T04:00:00.000Z",
        "kind": "credit",
        "description": {
            "subscriptionId": "[...]",
            "planId": "professional-new-eur"
        },
        "uid": "[...]"
    }
]`);
        const redactedDebits = statement!.debits.map(d => {
            (d.description as any).subscriptionId = '[...]';
            d.creditId = '[...]';
            d.uid = '[...]';
            return d;
        })
        expect(JSON.stringify(redactedDebits, null, 4)).to.be.equal(`[
    {
        "userId": "Sven",
        "amount": -11904,
        "date": "2000-01-01T03:59:59.999Z",
        "creditId": "[...]",
        "kind": "expiry",
        "description": {
            "subscriptionId": "[...]",
            "planId": "professional-new-eur"
        },
        "uid": "[...]"
    }
]`);
    }

    @test async testInvalidSessionDates() {
        await this.workspaceDb.storeInstance({
            creationTime: start,
            startedTime: '',
            stoppedTime: '',
            id: '' + (++this.id),
            workspaceId: '1',
            ideUrl: '',
            region: '',
            workspaceImage: '',
            status: { phase: 'running', conditions: {} }
        });
        let statement = await this.accountService.getAccountStatement('Sven', hoursLater(start, 1));
        expect(statement!.remainingHours).to.be.equal(100);

        await this.workspaceDb.storeInstance({
            creationTime: hoursLater(start, 10),
            startedTime: undefined,
            stoppedTime: undefined,
            id: '' + (++this.id),
            workspaceId: '1',
            ideUrl: '',
            region: '',
            workspaceImage: '',
            status: { phase: 'running', conditions: {} }
        });
        statement = await this.accountService.getAccountStatement('Sven', hoursLater(start, 12));
        expect(statement!.remainingHours).to.be.equal(100);
    }

    id = 0

    private async createSession(reference: string, hours: number) {
        const start = (hours < 0) ? hoursLater(reference, hours) : reference
        const stop = (hours < 0) ? reference : hoursLater(reference, hours)
        await this.workspaceDb.storeInstance({
            creationTime: start,
            startedTime: start,
            stoppedTime: stop,
            id: '' + (++this.id),
            workspaceId: '1',
            ideUrl: '',
            region: '',
            workspaceImage: '',
            status: { phase: 'running', conditions: {} }
        });
    }

    private async invoice(date: string): Promise<string> {
        const statement = await this.accountService.getAccountStatement('Sven', date);
        const result = this.stringifyStatement(statement);
        console.log(result);
        return result;
    }

    private stringifyStatement(statement: AccountStatement): string {
        const result = [...statement.credits, ...statement.debits]
            .sort((e0, e1) => {
                const timeDiff = e0.date.localeCompare(e1.date)
                return timeDiff === 0
                    ? this.rank(e0) - this.rank(e1)
                    : timeDiff
            })
            .map(e => `${e.date} ${e.amount} ${e.kind}${e.remainingAmount !== undefined ? ' ' + e.remainingAmount : ''}`)
            .join('\n');
        return result;
    }

    private rank(t: AccountEntry): number {
        switch (t.kind) {
            case 'carry':
                return 1;
            case 'credit':
                return 2;
            case 'session':
                return 3;
            case 'loss':
                return 4;
            case 'expiry':
                return 5;
            case 'open':
                return 6;
        }
    }

    private async remainingHours(date: string, numInstances = 1, includeNext = false) {
        const statement = await this.accountService.getAccountStatement('Sven', date);
        const statementString = this.stringifyStatement(statement);
        console.log(statementString);
        const result = this.accountService.getRemainingUsageHours(statement, numInstances, includeNext)
        console.log(result);
        return result;
    }
}

const localTestContainer = testContainer.createChild();
localTestContainer.bind(AccountServiceSpec).toSelf().inSingletonScope();
localTestContainer.bind(AccountServiceImpl).toSelf().inSingletonScope();
localTestContainer.bind(AccountService).toService(AccountServiceImpl);
localTestContainer.bind(AccountingServer).toSelf().inSingletonScope();
localTestContainer.bind(SubscriptionService).toSelf().inSingletonScope();
module.exports = new AccountServiceSpec()
