/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { User } from "@gitpod/gitpod-protocol";
import { ifEnvVarNotSet } from "@gitpod/gitpod-protocol/lib/util/skip-if";
import { Container, ContainerModule } from "inversify";
import { retries, skip, suite, test, timeout } from "@testdeck/mocha";
import { expect } from "chai";
import { GitpodHostUrl } from "@gitpod/gitpod-protocol/lib/util/gitpod-host-url";
import { AuthProviderParams } from "../auth/auth-provider";
import { BitbucketServerContextParser } from "./bitbucket-server-context-parser";
import { BitbucketServerTokenHelper } from "./bitbucket-server-token-handler";
import { TokenService } from "../user/token-service";
import { Config } from "../config";
import { TokenProvider } from "../user/token-provider";
import { BitbucketServerApi } from "./bitbucket-server-api";
import { HostContextProvider } from "../auth/host-context-provider";
import { BitbucketServerRepositoryProvider } from "./bitbucket-server-repository-provider";

@suite(timeout(10000), retries(0), skip(ifEnvVarNotSet("GITPOD_TEST_TOKEN_BITBUCKET_SERVER")))
class TestBitbucketServerRepositoryProvider {
    protected service: BitbucketServerRepositoryProvider;
    protected user: User;

    static readonly AUTH_HOST_CONFIG: Partial<AuthProviderParams> = {
        id: "MyBitbucketServer",
        type: "BitbucketServer",
        verified: true,
        description: "",
        icon: "",
        host: "bitbucket.gitpod-self-hosted.com",
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
                bind(BitbucketServerRepositoryProvider).toSelf().inSingletonScope();
                bind(BitbucketServerContextParser).toSelf().inSingletonScope();
                bind(AuthProviderParams).toConstantValue(TestBitbucketServerRepositoryProvider.AUTH_HOST_CONFIG);
                bind(BitbucketServerTokenHelper).toSelf().inSingletonScope();
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                bind(TokenService).toConstantValue({
                    createGitpodToken: async () => ({ token: { value: "foobar123-token" } }),
                } as any);
                bind(Config).toConstantValue({
                    hostUrl: new GitpodHostUrl("https://gitpod.io"),
                });
                bind(TokenProvider).toConstantValue(<TokenProvider>{
                    getTokenForHost: async () => {
                        return {
                            value: process.env.GITPOD_TEST_TOKEN_BITBUCKET_SERVER || "undefined",
                            scopes: [],
                        };
                    },
                });
                bind(BitbucketServerApi).toSelf().inSingletonScope();
                bind(HostContextProvider).toConstantValue({});
            }),
        );
        this.service = container.get(BitbucketServerRepositoryProvider);
        this.user = {
            creationDate: "",
            id: "user1",
            identities: [
                {
                    authId: "user1",
                    authName: "AlexTugarev",
                    authProviderId: "MyBitbucketServer",
                },
            ],
        };
    }

    @test async test_getRepo_ok() {
        const result = await this.service.getRepo(this.user, "JLDEC", "jldec-repo-march-30");
        expect(result).to.deep.include({
            webUrl: "https://bitbucket.gitpod-self-hosted.com/projects/JLDEC/repos/jldec-repo-march-30",
            cloneUrl: "https://bitbucket.gitpod-self-hosted.com/scm/jldec/jldec-repo-march-30.git",
        });
    }

    @test async test_getBranch_ok() {
        const result = await this.service.getBranch(this.user, "JLDEC", "jldec-repo-march-30", "main");
        expect(result).to.deep.include({
            name: "main",
        });
    }

    @test async test_getBranches_ok() {
        const result = await this.service.getBranches(this.user, "JLDEC", "jldec-repo-march-30");
        expect(result.length).to.be.gte(1);
        expect(result[0]).to.deep.include({
            name: "main",
        });
    }

    @test async test_getBranches_ok_2() {
        try {
            await this.service.getBranches(this.user, "mil", "gitpod-large-image");
            expect.fail("this should not happen while 'mil/gitpod-large-image' has NO default branch configured.");
        } catch (error) {
            expect(error.message).to.include(
                "refs/heads/master is set as the default branch, but this branch does not exist",
            );
        }
    }

    @test async test_getCommitInfo_ok() {
        const result = await this.service.getCommitInfo(this.user, "JLDEC", "jldec-repo-march-30", "test");
        expect(result).to.deep.include({
            author: "Alex Tugarev",
        });
    }

    @test async test_getUserRepos_ok() {
        const result = await this.service.getUserRepos(this.user);
        expect(result).to.contain({
            url: "https://7990-alextugarev-bbs-6v0gqcpgvj7.ws-eu102.gitpod.io/scm/~alex.tugarev/user.repo.git",
            name: "user.repo",
        });
    }
}

module.exports = new TestBitbucketServerRepositoryProvider();
