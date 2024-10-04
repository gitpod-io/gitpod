/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Commit, Repository, User } from "@gitpod/gitpod-protocol";
import * as chai from "chai";
import { Container, ContainerModule } from "inversify";
import { retries, skip, suite, test, timeout } from "@testdeck/mocha";
import { AuthProviderParams } from "../auth/auth-provider";
import { HostContextProvider } from "../auth/host-context-provider";
import { DevData } from "../dev/dev-data";
import { TokenProvider } from "../user/token-provider";
import { BitbucketApiFactory, BasicAuthBitbucketApiFactory } from "./bitbucket-api-factory";
import { BitbucketFileProvider } from "./bitbucket-file-provider";
import { BitbucketTokenHelper } from "./bitbucket-token-handler";
const expect = chai.expect;
import { ifEnvVarNotSet } from "@gitpod/gitpod-protocol/lib/util/skip-if";

@suite(timeout(10000), retries(2), skip(ifEnvVarNotSet("GITPOD_TEST_TOKEN_BITBUCKET")))
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
        },
    };

    public before() {
        const container = new Container();
        container.load(
            new ContainerModule((bind, unbind, isBound, rebind) => {
                bind(BitbucketFileProvider).toSelf().inSingletonScope();
                bind(AuthProviderParams).toConstantValue(TestBitbucketFileProvider.AUTH_HOST_CONFIG);
                bind(BitbucketTokenHelper).toSelf().inSingletonScope();
                bind(TokenProvider).toConstantValue(<TokenProvider>{
                    getTokenForHost: async () => DevData.createBitbucketTestToken(),
                });
                bind(BitbucketApiFactory).to(BasicAuthBitbucketApiFactory).inSingletonScope();
                bind(HostContextProvider).toConstantValue({
                    get: (hostname: string) => {
                        authProvider: {
                            ("Public-Bitbucket");
                        }
                    },
                });
            }),
        );
        this.fileProvider = container.get(BitbucketFileProvider);
        this.user = DevData.createTestUser();
    }

    @test public async testGetFileContents() {
        const result = await this.fileProvider.getFileContent(
            { repository: { owner: "gitpod", name: "integration-tests" }, revision: "5a24a0c" } as Commit,
            this.user,
            "README.md",
        );
        expect(result).to.equal(`# README #

This is the readme of the second branch.`);
    }

    @test public async testGetLastChangeRevision_ok() {
        const result = await this.fileProvider.getLastChangeRevision(
            { owner: "gitpod", name: "integration-tests" } as Repository,
            "second-branch",
            this.user,
            "README.md",
        );
        expect(result).to.equal("5a24a0c8a7b42c2e6418593d788e17cb987bda25");
    }

    @test public async testGetLastChangeRevision_not_found() {
        // it looks like expecting a promise to throw doesn't work, so we hack it with a try-catch
        let didThrow = false;
        try {
            await this.fileProvider.getLastChangeRevision(
                { owner: "gitpod", name: "integration-tests" } as Repository,
                "da2119f51b0e744cb6b36399f8433b477a4174ef", // a pinned commit on master
                this.user,
                "gitpod.Dockerfile",
            );
        } catch (err) {
            didThrow = true;
        }
        expect(didThrow).to.be.true;
    }
}

module.exports = new TestBitbucketFileProvider();
