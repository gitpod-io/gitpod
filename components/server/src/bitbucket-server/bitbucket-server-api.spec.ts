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

@suite(timeout(10000), retries(0), skip(ifEnvVarNotSet("GITPOD_TEST_TOKEN_BITBUCKET_SERVER")))
class TestBitbucketServerApi {
    protected api: BitbucketServerApi;
    protected user: User;

    static readonly AUTH_HOST_CONFIG: Partial<AuthProviderParams> = {
        id: "MyBitbucketServer",
        type: "BitbucketServer",
        verified: true,
        host: "bitbucket.gitpod-self-hosted.com",
        oauth: {} as any,
    };

    public before() {
        const container = new Container();
        container.load(
            new ContainerModule((bind, unbind, isBound, rebind) => {
                bind(BitbucketServerApi).toSelf().inSingletonScope();
                bind(BitbucketServerContextParser).toSelf().inSingletonScope();
                bind(AuthProviderParams).toConstantValue(TestBitbucketServerApi.AUTH_HOST_CONFIG);
                bind(BitbucketServerTokenHelper).toSelf().inSingletonScope();
                bind(TokenService).toConstantValue({
                    createGitpodToken: async () => ({ token: { value: "foobar123-token" } }),
                } as any);
                bind(Config).toConstantValue({
                    hostUrl: new GitpodHostUrl("https://gitpod.io"),
                });
                bind(TokenProvider).toConstantValue(<TokenProvider>{
                    getTokenForHost: async () => {
                        return {
                            value: process.env["GITPOD_TEST_TOKEN_BITBUCKET_SERVER"] || "undefined",
                            scopes: [],
                        };
                    },
                });
                bind(HostContextProvider).toConstantValue({
                    get: (hostname: string) => {
                        authProvider: {
                            ("BBS");
                        }
                    },
                });
            }),
        );
        this.api = container.get(BitbucketServerApi);
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

    @test async test_currentUsername_ok() {
        const result = await this.api.currentUsername(process.env["GITPOD_TEST_TOKEN_BITBUCKET_SERVER"]!);
        expect(result).to.equal("AlexTugarev");
    }

    @test async test_getUserProfile_ok() {
        const result = await this.api.getUserProfile(process.env["GITPOD_TEST_TOKEN_BITBUCKET_SERVER"]!, "AlexTugarev");
        expect(result).to.deep.include({
            id: 105, // Identity.authId
            name: "AlexTugarev", // Identity.authName
            slug: "alextugarev", // used in URLs
            displayName: "Alex Tugarev",
        });
    }

    @test async test_getRepos_ok() {
        const result = await this.api.getRepos(process.env["GITPOD_TEST_TOKEN_BITBUCKET_SERVER"]!, {
            permission: "REPO_READ",
        });
        expect(result.length).to.be.equal(28);

        // TestBitbucketServerApi
        // BBS: GET https://7990-alextugarev-bbs-6v0gqcpgvj7.ws-eu102.gitpod.io/rest/api/1.0/repos?permission=REPO_READ&start=0 - OK
        // BBS: GET https://7990-alextugarev-bbs-6v0gqcpgvj7.ws-eu102.gitpod.io/rest/api/1.0/repos?permission=REPO_READ&start=27 - OK
        //     ✓ test_getRepos_ok (87ms)
        //   1 passing (93ms)
    }
}

module.exports = new TestBitbucketServerApi();
