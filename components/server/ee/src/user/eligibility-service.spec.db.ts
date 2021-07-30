/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { Identity, User } from '@gitpod/gitpod-protocol';
import * as chai from 'chai';
import { suite, test } from 'mocha-typescript';
import { QueryRunner } from 'typeorm';
import { testContainer } from '@gitpod/gitpod-db/lib/test-container';
import { UserDB, DBUser, TransactionalUserDBImpl, TypeORM, TracedWorkspaceDB, bindDbWithTracing, WorkspaceDB } from '@gitpod/gitpod-db/lib';
import { ContainerModule, Container } from 'inversify';
import { UserService } from '../../../src/user/user-service';

import { SubscriptionService } from '@gitpod/gitpod-payment-endpoint/lib/accounting';
import { DBSubscription } from '@gitpod/gitpod-db/lib/typeorm/entity/db-subscription';
import { TokenService } from '../../../src/user/token-service';
import { TokenProvider } from '../../../src/user/token-provider';
import { Config } from '../../../src/config';
import { TokenGarbageCollector } from '../../../src/user/token-garbage-collector';
import { ConsensusLeaderQorum } from '../../../src/consensus/consensus-leader-quorum';
import { ConsensusLeaderMessenger } from '../../../src/consensus/consensus-leader-messenger';
import { InMemoryConsensusLeaderMessenger } from '../../../src/consensus/inmemory-consensus-leader-messenger';
import { TracingManager } from '@gitpod/gitpod-protocol/lib/util/tracing';
import { EligibilityService } from '../user/eligibility-service';
import { EMailDomainService, EMailDomainServiceImpl } from '../auth/email-domain-service';
import { AuthProviderParams } from '../../../src/auth/auth-provider';
import { HostContainerMappingEE } from '../auth/host-container-mapping';
import { HostContextProviderFactory, HostContextProvider } from '../../../src/auth/host-context-provider';
import { HostContextProviderImpl } from '../../../src/auth/host-context-provider-impl';
const expect = chai.expect;


const userServiceTestContainerModule = new ContainerModule((bind, unbind, isBound, rebind) => {
    bind(UserService).toSelf().inRequestScope();
    bind(EligibilityService).toSelf().inRequestScope();
    bind(EMailDomainService).to(EMailDomainServiceImpl).inSingletonScope();
    bind(HostContainerMappingEE).toSelf().inSingletonScope();
    bind(HostContextProviderFactory).toDynamicValue(({ container }) => ({
        createHostContext: (config: AuthProviderParams) => HostContextProviderImpl.createHostContext(container, config)
    })).inSingletonScope();
    bind(HostContextProvider).to(HostContextProviderImpl).inSingletonScope();
    bind(SubscriptionService).toSelf().inSingletonScope();
    bind(TokenService).toSelf().inSingletonScope();
    bind(TokenProvider).toService(TokenService);
    bind(TokenGarbageCollector).toSelf();
    bind(ConsensusLeaderQorum).toSelf().inRequestScope();
    bind(ConsensusLeaderMessenger).to(InMemoryConsensusLeaderMessenger).inSingletonScope();
    bindDbWithTracing(TracedWorkspaceDB, bind, WorkspaceDB).inSingletonScope();
    bind(TracingManager).toSelf().inSingletonScope();

    // TODO: something pulls in env which makes this test really difficult.
    //       How do we deal with this in other scenarios?
    //       Answer: Now that we have Config it's a tad easier to bind a (partial) Config for these tests here
    bind(Config).toSelf();
});
function getContainer() {
    const userServiceTestContainer = testContainer.createChild();
    userServiceTestContainer.load(userServiceTestContainerModule);
    return userServiceTestContainer;
}

@suite.skip
export class EligibilityServiceSpec {
    userServiceTestContainer: Container = getContainer();
    typeORM = this.userServiceTestContainer.get<TypeORM>(TypeORM);
    userDb: UserDB;
    queryRunner: QueryRunner;

    async before() {
        const connection = await this.typeORM.getConnection();
        const manager = connection.manager;
        await manager.clear(DBUser);
        await manager.clear(DBSubscription);
        this.queryRunner = connection.createQueryRunner();
        await this.queryRunner.connect();
        await this.queryRunner.startTransaction();
        this.userDb = new TransactionalUserDBImpl(this.queryRunner.manager)
    }

    readonly _IDENTITY1: Identity = {
        authProviderId: "GitHub",
        authId: "4321",
        authName: "gero",
        deleted: false,
        primaryEmail: undefined,
        readonly: false
    };
    get IDENTITY1() { return Object.assign({}, this._IDENTITY1); }  // Copy to avoid pollution
    protected async setupUser1(partial: Partial<User>): Promise<User> {
        let user = await this.userDb.newUser();
        user = {
            ...user,
            ...partial
        };
        user.identities.push(this.IDENTITY1);
        user = await this.userDb.storeUser(user);
        return user;
    }

    async after() {
        this.queryRunner.rollbackTransaction();
    }

    @test public async canOpenPrivateRepo_userCreationDate() {
        const userCreationDate = new Date(2018, 9, 1);
        const user = await this.setupUser1({ creationDate: userCreationDate.toISOString() });
        const svc = this.userServiceTestContainer.get<EligibilityService>(EligibilityService);

        const oneDayAfterJoined = new Date(userCreationDate.getTime());
        oneDayAfterJoined.setDate(2);
        let actual = await svc.mayOpenPrivateRepo(user, oneDayAfterJoined);
        expect(actual, "way within free period").to.be.true;

        actual = await svc.mayOpenPrivateRepo(user, new Date(userCreationDate.getTime() + EligibilityService.DURATION_30_DAYS_MILLIS - 1));
        expect(actual, "still within free period").to.be.true;

        actual = await svc.mayOpenPrivateRepo(user, new Date(userCreationDate.getTime() + EligibilityService.DURATION_30_DAYS_MILLIS + 1));
        expect(actual, "just out of free period").to.be.false;
    }
}

module.exports = new EligibilityServiceSpec()
