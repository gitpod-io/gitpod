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
        host: "bitbucket.gitpod-dev.com",
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
                            value: process.env["GITPOD_TEST_TOKEN_BITBUCKET_SERVER"] || "undefined",
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
        const result = await this.service.getRepo(this.user, "TES", "2k-repos-1076");
        expect(result).to.deep.include({
            webUrl: "https://bitbucket.gitpod-dev.com/projects/TES/repos/2k-repos-1076",
            cloneUrl: "https://bitbucket.gitpod-dev.com/scm/tes/2k-repos-1076.git",
        });
    }

    @test async test_getBranch_ok() {
        const result = await this.service.getBranch(this.user, "TES", "2k-repos-0", "frozen/master");
        expect(result).to.deep.include({
            name: "frozen/master",
            commit: {
                author: "Admin",
                authorAvatarUrl: "https://secure.gravatar.com/avatar/30cfcf1a839db721063f3c812558bf1e.jpg?s=64&d=mm",
                authorDate: "2024-09-20T14:21:19.000Z",
                commitMessage: "a test push",
                sha: "fb6e71e9a26215a37fd940253e3f996224fbfb2a",
            },
        });
    }

    @test async test_getBranches_ok() {
        const result = await this.service.getBranches(this.user, "TES", "2k-repos-0");
        expect(result.length).to.be.gte(1);
        expect(result[0]).to.deep.include({
            name: "master",
        });
    }

    @test async test_getBranches_ok_2() {
        const response = await this.service.getBranches(this.user, "TES", "2k-repos-1076");
        expect(response.length).to.eq(0);
    }

    @test async test_getCommitHistory_ok() {
        const revision = "2781809c095c8cf53c60a524499a9a74649ab506";
        const result = await this.service.getCommitHistory(this.user, "filip", "spring-petclinic", revision, 100);
        // the unwritten rule is that the revision is not included in the result
        // where needed, the caller can add it to the result artificially
        // see for example getCommitHistoryForContext in src/prebuilds/incremental-workspace-service.ts
        expect(result).to.not.deep.include(revision);
        expect(result.length).to.equal(16);
    }

    @test async test_getCommitInfo_ok() {
        const result = await this.service.getCommitInfo(
            this.user,
            "TES",
            "2k-repos-0",
            "fb6e71e9a26215a37fd940253e3f996224fbfb2a",
        );
        expect(result).to.not.be.undefined;
        expect(result?.author).to.equal("Admin");
    }

    @test async test_getCommitInfo_ok_2() {
        const result = await this.service.getCommitInfo(this.user, "TES", "2k-repos-0", "frozen/master");
        expect(result).to.not.be.undefined;
        expect(result?.author).to.equal("Admin");
    }

    @test async test_getUserRepos_ok() {
        const result = await this.service.getUserRepos(this.user);
        // todo(ft): possibly change to not directly rely on a single returned repository, since the recent repo list for BBS is prone to change
        expect(result).to.deep.include({
            url: "https://bitbucket.gitpod-dev.com/scm/~svenefftinge/browser-extension-test.git",
            name: "browser-extension-test",
        });
    }

    @test async test_searchRepos_ok() {
        const result = await this.service.searchRepos(this.user, "2k-repos-1076", 100);
        expect(result.length).to.be.eq(1);
    }

    @test async test_searchRepos_shortSearch() {
        const resultA = await this.service.searchRepos(this.user, "2", 100);
        expect(resultA).to.not.be.empty;

        const resultB = await this.service.searchRepos(this.user, "2k", 100);
        expect(resultB).to.not.be.empty;
    }

    // bitbucket searches for repo and project names, not for the full path
    @test async test_searchRepos_pathSubstring() {
        const result = await this.service.searchRepos(this.user, "/2k-repos-1076", 100);
        expect(result).to.be.empty;
    }

    @test async test_searchRepos_nameSubstring() {
        const result = await this.service.searchRepos(this.user, "repos-1076", 100);
        expect(result).to.be.empty;
    }
}

module.exports = new TestBitbucketServerRepositoryProvider();
