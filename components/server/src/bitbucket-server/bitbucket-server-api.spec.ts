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
        host: "bitbucket.gitpod-dev.com",
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
        expect(result).to.equal("admin-tester");
    }

    @test async test_getUserProfile_ok() {
        const result = await this.api.getUserProfile(process.env["GITPOD_TEST_TOKEN_BITBUCKET_SERVER"]!, "alex");
        expect(result).to.deep.include({
            id: 53, // Identity.authId
            name: "alex", // Identity.authName
            slug: "alex", // used in URLs
            displayName: "Alex Tugarev",
        });
    }

    @test async test_getRepos_no_searchString() {
        const result = await this.api.getRepos(process.env["GITPOD_TEST_TOKEN_BITBUCKET_SERVER"]!, {
            permission: "REPO_READ",
        });
        expect(result.length).to.be.equal(10_000);

        // BBS: GET https://bitbucket.gitpod-dev.com/rest/api/1.0/repos?permission=REPO_READ&limit=1000&start=0&limit=1000 - OK
        // BBS: GET https://bitbucket.gitpod-dev.com/rest/api/1.0/repos?permission=REPO_READ&limit=1000&start=1002&limit=1000 - OK
        // BBS: GET https://bitbucket.gitpod-dev.com/rest/api/1.0/repos?permission=REPO_READ&limit=1000&start=2002&limit=1000 - OK
        // BBS: GET https://bitbucket.gitpod-dev.com/rest/api/1.0/repos?permission=REPO_READ&limit=1000&start=3002&limit=1000 - OK
        // BBS: GET https://bitbucket.gitpod-dev.com/rest/api/1.0/repos?permission=REPO_READ&limit=1000&start=4002&limit=1000 - OK
        // BBS: GET https://bitbucket.gitpod-dev.com/rest/api/1.0/repos?permission=REPO_READ&limit=1000&start=5002&limit=1000 - OK
        // BBS: GET https://bitbucket.gitpod-dev.com/rest/api/1.0/repos?permission=REPO_READ&limit=1000&start=6002&limit=1000 - OK
        // BBS: GET https://bitbucket.gitpod-dev.com/rest/api/1.0/repos?permission=REPO_READ&limit=1000&start=7002&limit=1000 - OK
        // BBS: GET https://bitbucket.gitpod-dev.com/rest/api/1.0/repos?permission=REPO_READ&limit=1000&start=8002&limit=1000 - OK
        // BBS: GET https://bitbucket.gitpod-dev.com/rest/api/1.0/repos?permission=REPO_READ&limit=1000&start=9002&limit=1000 - OK
        //     ✓ test_getRepos_no_searchString (3746ms)
    }

    @test async test_getRepos_cap_no_searchstring() {
        const result = await this.api.getRepos(process.env["GITPOD_TEST_TOKEN_BITBUCKET_SERVER"]!, {
            permission: "REPO_READ",
            maxPages: 3,
        });
        expect(result.length).to.be.equal(3000);

        // BBS: GET https://bitbucket.gitpod-dev.com/rest/api/1.0/repos?permission=REPO_READ&limit=1000&start=0&limit=1000 - OK
        // BBS: GET https://bitbucket.gitpod-dev.com/rest/api/1.0/repos?permission=REPO_READ&limit=1000&start=1002&limit=1000 - OK
        // BBS: GET https://bitbucket.gitpod-dev.com/rest/api/1.0/repos?permission=REPO_READ&limit=1000&start=2002&limit=1000 - OK
        //     ✓ test_getRepos_cap_no_searchstring (1007ms)
    }

    @test async test_getRepos_searchString() {
        const result = await this.api.getRepos(process.env["GITPOD_TEST_TOKEN_BITBUCKET_SERVER"]!, {
            permission: "REPO_READ",
            searchString: "zero",
        });
        expect(result.length).to.be.equal(1000);
        expect(result[0].links.clone[0].href).to.equal("https://bitbucket.gitpod-dev.com/scm/tes/zero-minus-1.git");

        // BBS: GET https://bitbucket.gitpod-dev.com/rest/api/1.0/repos?permission=REPO_READ&limit=1000&start=0&name=zero - OK
        // BBS: GET https://bitbucket.gitpod-dev.com/rest/api/1.0/repos?permission=REPO_READ&limit=1000&start=0&projectname=zero - OK
        //      ✓ test_getRepos_searchString (552ms)
    }

    @test async test_getRepos_searchString_2() {
        const result = await this.api.getRepos(process.env["GITPOD_TEST_TOKEN_BITBUCKET_SERVER"]!, {
            permission: "REPO_READ",
            searchString: "zero-minus-1",
        });
        expect(result.length).to.be.equal(112);

        // BBS: GET https://bitbucket.gitpod-dev.com/rest/api/1.0/repos?permission=REPO_READ&limit=1000&start=0&name=zero-minus-1 - OK
        // BBS: GET https://bitbucket.gitpod-dev.com/rest/api/1.0/repos?permission=REPO_READ&limit=1000&start=0&projectname=zero-minus-1 - OK
        //     ✓ test_getRepos_searchString_2 (172ms)
    }

    @test async test_getRepos_searchString_works_for_prefix_only() {
        const result = await this.api.getRepos(process.env["GITPOD_TEST_TOKEN_BITBUCKET_SERVER"]!, {
            permission: "REPO_READ",
            searchString: "-minus-1",
        });
        expect(result.length).to.be.equal(0);

        // BBS: GET https://bitbucket.gitpod-dev.com/rest/api/1.0/repos?permission=REPO_READ&limit=1000&start=0&name=zero-minus-1 - OK
        // BBS: GET https://bitbucket.gitpod-dev.com/rest/api/1.0/repos?permission=REPO_READ&limit=1000&start=0&projectname=zero-minus-1 - OK
        //     ✓ test_getRepos_searchString_works_for_prefix_only (172ms)
    }

    @test async test_getRepos_searchString_wildcards_are_not_supported() {
        const result = await this.api.getRepos(process.env["GITPOD_TEST_TOKEN_BITBUCKET_SERVER"]!, {
            permission: "REPO_READ",
            searchString: "*-minus-1",
        });
        expect(result.length).to.be.equal(0);

        // BBS: GET https://bitbucket.gitpod-dev.com/rest/api/1.0/repos?permission=REPO_READ&limit=1000&start=0&name=zero-minus-1 - OK
        // BBS: GET https://bitbucket.gitpod-dev.com/rest/api/1.0/repos?permission=REPO_READ&limit=1000&start=0&projectname=zero-minus-1 - OK
        //     ✓ test_getRepos_searchString_wildcards_are_not_supported (172ms)
    }

    @test async test_getRepos_searchString_unmatched() {
        const result = await this.api.getRepos(process.env["GITPOD_TEST_TOKEN_BITBUCKET_SERVER"]!, {
            permission: "REPO_READ",
            searchString: "RANDOM_asd8sdh7s8hsdhvisduh",
        });
        expect(result.length).to.be.equal(0);

        // BBS: GET https://bitbucket.gitpod-dev.com/rest/api/1.0/repos?permission=REPO_READ&limit=1000&start=0&name=RANDOM_asd8sdh7s8hsdhvisduh - OK
        // BBS: GET https://bitbucket.gitpod-dev.com/rest/api/1.0/repos?permission=REPO_READ&limit=1000&start=0&projectname=RANDOM_asd8sdh7s8hsdhvisduh - OK
        //      ✓ test_getRepos_searchString_unmatched (126ms)
    }
}

module.exports = new TestBitbucketServerApi();
