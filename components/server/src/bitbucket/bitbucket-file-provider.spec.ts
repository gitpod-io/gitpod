/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Commit, Repository, User } from "@gitpod/gitpod-protocol";
import * as chai from 'chai';
import { Container, ContainerModule } from "inversify";
import { retries, suite, test, timeout } from "mocha-typescript";
import { AuthProviderParams } from "../auth/auth-provider";
import { HostContextProvider } from "../auth/host-context-provider";
import { DevData } from "../dev/dev-data";
import { TokenProvider } from "../user/token-provider";
import { BitbucketApiFactory, BasicAuthBitbucketApiFactory } from './bitbucket-api-factory';
import { BitbucketFileProvider } from "./bitbucket-file-provider";
import { BitbucketTokenHelper } from "./bitbucket-token-handler";
const expect = chai.expect;
import { skipIfEnvVarNotSet } from "@gitpod/gitpod-protocol/lib/util/skip-if";

@suite(timeout(10000), retries(2), skipIfEnvVarNotSet("GITPOD_TEST_TOKEN_BITBUCKET"))
class TestBitbucketFileProvider {

    protected fileProvider: BitbucketFileProvider;
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
            bind(BitbucketFileProvider).toSelf().inSingletonScope();
            bind(AuthProviderParams).toConstantValue(TestBitbucketFileProvider.AUTH_HOST_CONFIG);
            bind(BitbucketTokenHelper).toSelf().inSingletonScope();
            bind(TokenProvider).toConstantValue(<TokenProvider>{
                getTokenForHost: async () => DevData.createBitbucketTestToken(),
                getFreshPortAuthenticationToken: async (user: User, workspaceId: string) => DevData.createPortAuthTestToken(workspaceId),
            });
            bind(BitbucketApiFactory).to(BasicAuthBitbucketApiFactory).inSingletonScope();
            bind(HostContextProvider).toConstantValue({
                get: (hostname: string) => { authProvider: { "Public-Bitbucket" } }
            });
        }));
        this.fileProvider = container.get(BitbucketFileProvider);
        this.user = DevData.createTestUser();
    }

    @test public async testGetFileContents() {
        const result = await this.fileProvider.getFileContent({ repository: { owner: "gitpod", name: "integration-tests" }, revision: "5a24a0c" } as Commit, this.user, "README.md");
        expect(result).to.equal(`# README #

This is the readme of the second branch.`);
    }

    @test public async testGetLastChangeRevision() {
        const result = await this.fileProvider.getLastChangeRevision({ owner: "gitpod", name: "integration-tests" } as Repository, "second-branch", this.user, "README.md");
        expect(result).to.equal("5a24a0c8a7b42c2e6418593d788e17cb987bda25");
    }
}

module.exports = new TestBitbucketFileProvider();
