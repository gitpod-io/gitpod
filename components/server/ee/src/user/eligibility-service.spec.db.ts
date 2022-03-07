/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { testContainer } from '@gitpod/gitpod-db/lib/test-container';
import { DBUser, DBIdentity, UserDB, AccountingDB, TeamSubscriptionDB } from '@gitpod/gitpod-db/lib';
import { TypeORM } from '@gitpod/gitpod-db/lib/typeorm/typeorm';
import { Subscription } from '@gitpod/gitpod-protocol/lib/accounting-protocol';
import { Plans } from '@gitpod/gitpod-protocol/lib/plans';
import * as chai from 'chai';
import { suite, test, timeout } from 'mocha-typescript';
import { Config } from '../../../src/config';
import { EligibilityService } from './eligibility-service';
import { DBSubscription } from '@gitpod/gitpod-db/lib/typeorm/entity/db-subscription';
import { DBTeamSubscription } from '@gitpod/gitpod-db/lib/typeorm/entity/db-team-subscription';
import { DBTeamSubscriptionSlot } from '@gitpod/gitpod-db/lib/typeorm/entity/db-team-subscription-slot';
import { Token, User } from '@gitpod/gitpod-protocol';
import { AccountService, AccountServiceImpl, SubscriptionService } from '@gitpod/gitpod-payment-endpoint/lib/accounting';
import { EMailDomainService, EMailDomainServiceImpl } from '../auth/email-domain-service';
import { TokenProvider } from "../../../src/user/token-provider";
import { AccountStatementProvider } from './account-statement-provider';

const expect = chai.expect;

const localTestContainer = testContainer.createChild();
localTestContainer.bind(EligibilityService).toSelf().inSingletonScope();
localTestContainer.bind(Config).toDynamicValue(ctx => ({
    enablePayment: true,
} as Config)).inSingletonScope();
localTestContainer.bind(SubscriptionService).toSelf().inSingletonScope();

localTestContainer.bind(EMailDomainService).to(EMailDomainServiceImpl).inSingletonScope();

localTestContainer.bind(TokenProvider).toDynamicValue(ctx => <TokenProvider>{
    getFreshPortAuthenticationToken: (user: User, host: string) => { return {} as Promise<Token> },
    getTokenForHost: (user: User, workspaceId: string) => { return {} as Promise<Token> },
});

localTestContainer.bind(AccountStatementProvider).toSelf().inRequestScope();
localTestContainer.bind(AccountServiceImpl).toSelf().inSingletonScope();
localTestContainer.bind(AccountService).toService(AccountServiceImpl);

const start = new Date(Date.UTC(2000, 0, 1)).toISOString();
const userId = 'Niemand';
const tsId = 'someTeamSubscription';
const subscriptionId = 'theSubscriptionForTsSlot';
const slotId = 'someSlotId';

@timeout(10000)
@suite class AccountServiceSpec {
    typeORM = localTestContainer.get<TypeORM>(TypeORM);
    cut = localTestContainer.get<EligibilityService>(EligibilityService);

    userDb = localTestContainer.get<UserDB>(UserDB);
    accountingDb = localTestContainer.get<AccountingDB>(AccountingDB);
    tsDb = localTestContainer.get<TeamSubscriptionDB>(TeamSubscriptionDB);

    subscription: Subscription;
    user: User;

    @timeout(10000)
    async before() {
        await this.purgeDB();

        this.user = await this.userDb.storeUser({
            id: userId,
            creationDate: start,
            fullName: 'Herr Niemand',
            identities: [{
                authProviderId: 'github.com',
                authId: 'Niemand',
                authName: 'Niemand',
                tokens: []
            }],
        });

        this.subscription = await this.accountingDb.newSubscription({
            userId,
            startDate: start,
            amount: 100,
            planId: 'test'
        });
    }

    protected async purgeDB() {
        const manager = (await this.typeORM.getConnection()).manager;
        await manager.query('SET FOREIGN_KEY_CHECKS = 0;');
        await manager.clear(DBIdentity);
        await manager.clear(DBUser);
        await manager.query('SET FOREIGN_KEY_CHECKS = 1;');

        await manager.clear(DBSubscription);
        await manager.clear(DBTeamSubscription);
        await manager.clear(DBTeamSubscriptionSlot);
    }

    protected async createTsSubscription(excludeFromMoreResources: boolean = false) {
        const plan = Plans.TEAM_PROFESSIONAL_EUR;
        const ts = await this.tsDb.storeTeamSubscriptionEntry({
            id: tsId,
            userId,
            paymentReference: "abcdef",
            planId: plan.chargebeeId,
            quantity: 1,
            startDate: start,
            excludeFromMoreResources,
        });

        const slot = await this.tsDb.storeSlot({
            id: slotId,
            teamSubscriptionId: tsId,
            assigneeId: userId,
            subscriptionId,
        });

        const sub = await this.accountingDb.storeSubscription(Subscription.create({
            userId,
            planId: plan.chargebeeId,
            startDate: start,
            amount: Plans.getHoursPerMonth(plan),
            teamSubscriptionSlotId: slot.id,
        }));
        return { plan, sub, ts, slot };
    }

    @timeout(5000)
    @test async testUserGetsMoreResources() {
        await this.createTsSubscription();

        const actual = await this.cut.userGetsMoreResources(this.user);
        expect(actual, "user with Team Unleashed gets 'more resources'").to.equal(true);
    }

    @timeout(5000)
    @test async testUserGetsMoreResources_excludeFromMoreResources() {
        await this.createTsSubscription(true);

        const actual = await this.cut.userGetsMoreResources(this.user);
        expect(actual, "user with Team Unleashed but excludeFromMoreResources set does not get 'more resources'").to.equal(false);
    }
}

module.exports = new AccountServiceSpec()
