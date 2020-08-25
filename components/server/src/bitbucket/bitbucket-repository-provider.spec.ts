/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { User } from "@gitpod/gitpod-protocol";
import * as chai from 'chai';
import { Container, ContainerModule } from "inversify";
import { retries, suite, test, timeout } from "mocha-typescript";
import { AuthProviderParams } from "../auth/auth-provider";
import { HostContextProvider } from "../auth/host-context-provider";
import { DevData } from "../dev/dev-data";
import { TokenProvider } from "../user/token-provider";
import BitbucketApiFactory from "./bitbucket-api-factory";
import { BitbucketRepositoryProvider } from "./bitbucket-repository-provider";
import { BitbucketTokenHelper } from "./bitbucket-token-handler";
const expect = chai.expect;
import { skipIfEnvVarNotSet } from "@gitpod/gitpod-protocol/lib/util/skip-if";

@suite(timeout(10000), retries(2), skipIfEnvVarNotSet("GITPOD_TEST_TOKEN_BITBUCKET"))
class TestBitbucketRepositoryProvider {

    protected repoProvider: BitbucketRepositoryProvider;
    protected user: User;

    static readonly AUTH_HOST_CONFIG: Partial<AuthProviderParams> = {
        id: "Public-Bitbucket",
        type: "Bitbucket",
        verified: true,
        description: "",
        icon: "",
        host: "bitbucket.org",
        oauth: {
            callBackUrl: "",
            clientId: "not-used",
            clientSecret: "",
            tokenUrl: "",
            scope: "",
            authorizationUrl: "",
        }
    }

    public before() {
        const container = new Container();
        container.load(new ContainerModule((bind, unbind, isBound, rebind) => {
            bind(BitbucketRepositoryProvider).toSelf().inSingletonScope();
            bind(AuthProviderParams).toConstantValue(TestBitbucketRepositoryProvider.AUTH_HOST_CONFIG);
            bind(BitbucketTokenHelper).toSelf().inSingletonScope();
            bind(TokenProvider).toConstantValue(<TokenProvider>{
                getTokenForHost: async () => DevData.createBitbucketTestToken(),
                getFreshPortAuthenticationToken: async (user: User, workspaceId: string) => DevData.createPortAuthTestToken(workspaceId),
            });
            bind(BitbucketApiFactory).toSelf().inSingletonScope();
            bind(HostContextProvider).toConstantValue({
                get: (hostname: string) => { authProvider: { "Public-Bitbucket" } }
            });
        }));
        this.repoProvider = container.get(BitbucketRepositoryProvider);
        this.user = DevData.createTestUser();
    }

    @test public async testGetRepo() {
        const result = await this.repoProvider.getRepo(this.user, "gitpod", "sample-repository");
        expect(result).to.deep.include({
            host: "bitbucket.org",
            owner: "gitpod",
            name: "sample-repository",
            cloneUrl: "https://gitpod@bitbucket.org/gitpod/sample-repository.git",
            description: "This is a sample repository.",
            webUrl: "https://bitbucket.org/gitpod/sample-repository",
        });
    }

}

module.exports = new TestBitbucketRepositoryProvider();
