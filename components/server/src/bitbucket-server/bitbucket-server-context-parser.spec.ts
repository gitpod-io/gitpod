/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { User } from "@gitpod/gitpod-protocol";
import { ifEnvVarNotSet } from "@gitpod/gitpod-protocol/lib/util/skip-if";
import { Container, ContainerModule } from "inversify";
import { skip, suite, test, timeout } from "@testdeck/mocha";
import { expect } from "chai";
import { GitpodHostUrl } from "@gitpod/gitpod-protocol/lib/util/gitpod-host-url";
import { BitbucketServerFileProvider } from "./bitbucket-server-file-provider";
import { AuthProviderParams } from "../auth/auth-provider";
import { BitbucketServerContextParser } from "./bitbucket-server-context-parser";
import { BitbucketServerTokenHelper } from "./bitbucket-server-token-handler";
import { TokenService } from "../user/token-service";
import { Config } from "../config";
import { TokenProvider } from "../user/token-provider";
import { BitbucketServerApi } from "./bitbucket-server-api";
import { HostContextProvider } from "../auth/host-context-provider";
import { URL } from "url";

@suite(timeout(10000), skip(ifEnvVarNotSet("GITPOD_TEST_TOKEN_BITBUCKET_SERVER")))
class TestBitbucketServerContextParser {
    protected parser: BitbucketServerContextParser;
    protected user: User;

    static readonly AUTH_HOST_CONFIG: Partial<AuthProviderParams> = {
        id: "MyBitbucketServer",
        type: "BitbucketServer",
        host: "bitbucket.gitpod-dev.com",
    };

    public before() {
        const container = new Container();
        container.load(
            new ContainerModule((bind, unbind, isBound, rebind) => {
                bind(BitbucketServerFileProvider).toSelf().inSingletonScope();
                bind(BitbucketServerContextParser).toSelf().inSingletonScope();
                bind(AuthProviderParams).toConstantValue(TestBitbucketServerContextParser.AUTH_HOST_CONFIG);
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
                bind(HostContextProvider).toConstantValue({
                    get: (hostname: string) => {
                        authProvider: {
                            ("BBS");
                        }
                    },
                });
            }),
        );
        this.parser = container.get(BitbucketServerContextParser);
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

    @test async test_tree_context_01() {
        const result = await this.parser.handle(
            {},
            this.user,
            "https://bitbucket.gitpod-dev.com/projects/GIT/repos/gitpod-test-repo",
        );

        expect(result).to.deep.include({
            ref: "master",
            refType: "branch",
            revision: "506e5aed317f28023994ecf8ca6ed91430e9c1a4",
            path: "",
            isFile: false,
            repository: {
                host: "bitbucket.gitpod-dev.com",
                owner: "GIT",
                name: "gitpod-test-repo",
                cloneUrl: "https://bitbucket.gitpod-dev.com/scm/git/gitpod-test-repo.git",
                webUrl: "https://bitbucket.gitpod-dev.com/projects/GIT/repos/gitpod-test-repo",
                defaultBranch: "master",
                private: true,
                repoKind: "projects",
            },
            title: "GIT/gitpod-test-repo - master",
        });
    }

    @test async test_tree_context_02() {
        const result = await this.parser.handle(
            {},
            this.user,
            "https://bitbucket.gitpod-dev.com/scm/git/gitpod-test-repo.git",
        );

        expect(result).to.deep.include({
            ref: "master",
            refType: "branch",
            revision: "506e5aed317f28023994ecf8ca6ed91430e9c1a4",
            path: "",
            isFile: false,
            repository: {
                host: "bitbucket.gitpod-dev.com",
                owner: "GIT",
                name: "gitpod-test-repo",
                cloneUrl: "https://bitbucket.gitpod-dev.com/scm/git/gitpod-test-repo.git",
                webUrl: "https://bitbucket.gitpod-dev.com/projects/GIT/repos/gitpod-test-repo",
                defaultBranch: "master",
                private: true,
                repoKind: "projects",
            },
            title: "git/gitpod-test-repo - master",
        });
    }

    @test async test_tree_context_03_user_repo() {
        const result = await this.parser.handle(
            {},
            this.user,
            "https://bitbucket.gitpod-dev.com/scm/~geropl/test-user-repo.git",
        );

        expect(result).to.deep.include({
            ref: "main",
            refType: "branch",
            revision: "153ceae2a36f7e0b320ac72b593164efe11cd4ad",
            path: "",
            isFile: false,
            repository: {
                host: "bitbucket.gitpod-dev.com",
                owner: "geropl",
                name: "test-user-repo",
                cloneUrl: "https://bitbucket.gitpod-dev.com/scm/~geropl/test-user-repo.git",
                webUrl: "https://bitbucket.gitpod-dev.com/users/geropl/repos/test-user-repo",
                defaultBranch: "main",
                private: true,
                repoKind: "users",
            },
            title: "geropl/test-user-repo - main",
        });
    }

    @test async test_commit_context_01_user_repo() {
        const result = await this.parser.handle(
            {},
            this.user,
            "https://bitbucket.gitpod-dev.com/users/geropl/repos/test-user-repo/commits/153ceae2a36f7e0b320ac72b593164efe11cd4ad",
        );

        expect(result).to.deep.include({
            refType: "revision",
            revision: "153ceae2a36f7e0b320ac72b593164efe11cd4ad",
            path: "",
            isFile: false,
            repository: {
                cloneUrl: "https://bitbucket.gitpod-dev.com/scm/~geropl/test-user-repo.git",
                defaultBranch: "main",
                host: "bitbucket.gitpod-dev.com",
                name: "test-user-repo",
                owner: "geropl",
                private: true,
                repoKind: "users",
                webUrl: "https://bitbucket.gitpod-dev.com/users/geropl/repos/test-user-repo",
            },
            title: "geropl/test-user-repo - 153ceae2a36f7e0b320ac72b593164efe11cd4ad",
        });
    }

    @test async test_commit_context_02() {
        const result = await this.parser.handle(
            {},
            this.user,
            "https://bitbucket.gitpod-dev.com/projects/GIT/repos/gitpod-test-repo/commits/506e5aed317f28023994ecf8ca6ed91430e9c1a4",
        );

        expect(result).to.deep.include({
            refType: "revision",
            revision: "506e5aed317f28023994ecf8ca6ed91430e9c1a4",
            path: "",
            isFile: false,
            repository: {
                cloneUrl: "https://bitbucket.gitpod-dev.com/scm/git/gitpod-test-repo.git",
                defaultBranch: "master",
                host: "bitbucket.gitpod-dev.com",
                name: "gitpod-test-repo",
                owner: "GIT",
                private: true,
                repoKind: "projects",
                webUrl: "https://bitbucket.gitpod-dev.com/projects/GIT/repos/gitpod-test-repo",
            },
            title: "GIT/gitpod-test-repo - 506e5aed317f28023994ecf8ca6ed91430e9c1a4",
        });
    }

    @test async test_commit_context_03_with_branch_ref() {
        const result = await this.parser.handle(
            {},
            this.user,
            "https://bitbucket.gitpod-dev.com/projects/GIT/repos/gitpod-test-repo/commits/506e5aed317f28023994ecf8ca6ed91430e9c1a4#master",
        );

        expect(result).to.deep.include({
            refType: "revision",
            revision: "506e5aed317f28023994ecf8ca6ed91430e9c1a4",
            path: "",
            isFile: false,
            repository: {
                cloneUrl: "https://bitbucket.gitpod-dev.com/scm/git/gitpod-test-repo.git",
                defaultBranch: "master",
                host: "bitbucket.gitpod-dev.com",
                name: "gitpod-test-repo",
                owner: "GIT",
                private: true,
                repoKind: "projects",
                webUrl: "https://bitbucket.gitpod-dev.com/projects/GIT/repos/gitpod-test-repo",
            },
            title: "GIT/gitpod-test-repo - 506e5aed317f28023994ecf8ca6ed91430e9c1a4",
        });
    }

    @test async test_branch_context_01() {
        const result = await this.parser.handle(
            {},
            this.user,
            "https://bitbucket.gitpod-dev.com/users/svenefftinge/repos/browser-extension-test/commits?until=refs%2Fheads%2Fmy-branch&merges=include",
        );

        expect(result).to.deep.include({
            ref: "my-branch",
            refType: "branch",
            revision: "3ca42b45bc693973cb21a112a418c13f8b4d11a5",
            path: "",
            isFile: false,
            repository: {
                cloneUrl: "https://bitbucket.gitpod-dev.com/scm/~svenefftinge/browser-extension-test.git",
                defaultBranch: "main",
                host: "bitbucket.gitpod-dev.com",
                name: "browser-extension-test",
                owner: "svenefftinge",
                repoKind: "users",
                private: false,
                webUrl: "https://bitbucket.gitpod-dev.com/users/svenefftinge/repos/browser-extension-test",
            },
            title: "svenefftinge/browser-extension-test - my-branch",
        });
    }

    @test async test_PR_context_01() {
        const result = await this.parser.handle(
            {},
            this.user,
            "https://bitbucket.gitpod-dev.com/projects/GIT/repos/gitpod-test-repo/pull-requests/1/commits",
        );

        expect(result).to.deep.include({
            title: "1test - DONT TOUCH",
            nr: 1,
            ref: "1test",
            refType: "branch",
            revision: "0d34597386bdd90976ed70991c39f566b290066d",
            repository: {
                host: "bitbucket.gitpod-dev.com",
                owner: "GIT",
                name: "gitpod-test-repo",
                cloneUrl: "https://bitbucket.gitpod-dev.com/scm/git/gitpod-test-repo.git",
                webUrl: "https://bitbucket.gitpod-dev.com/projects/GIT/repos/gitpod-test-repo",
                defaultBranch: "master",
                private: true,
                repoKind: "projects",
            },
            base: {
                ref: "master",
                refType: "branch",
                repository: {
                    host: "bitbucket.gitpod-dev.com",
                    owner: "GIT",
                    name: "gitpod-test-repo",
                    cloneUrl: "https://bitbucket.gitpod-dev.com/scm/git/gitpod-test-repo.git",
                    webUrl: "https://bitbucket.gitpod-dev.com/projects/GIT/repos/gitpod-test-repo",
                    defaultBranch: "master",
                    private: true,
                    repoKind: "projects",
                },
            },
        });
    }

    @test async test_PR_context_02() {
        const result = await this.parser.handle(
            {},
            this.user,
            "https://bitbucket.gitpod-dev.com/projects/GIT/repos/gitpod-test-repo/pull-requests/1/overview",
        );

        expect(result).to.deep.include({
            title: "1test - DONT TOUCH",
            nr: 1,
            ref: "1test",
            refType: "branch",
            revision: "0d34597386bdd90976ed70991c39f566b290066d",
            repository: {
                host: "bitbucket.gitpod-dev.com",
                owner: "GIT",
                name: "gitpod-test-repo",
                cloneUrl: "https://bitbucket.gitpod-dev.com/scm/git/gitpod-test-repo.git",
                webUrl: "https://bitbucket.gitpod-dev.com/projects/GIT/repos/gitpod-test-repo",
                defaultBranch: "master",
                private: true,
                repoKind: "projects",
            },
            base: {
                ref: "master",
                refType: "branch",
                repository: {
                    host: "bitbucket.gitpod-dev.com",
                    owner: "GIT",
                    name: "gitpod-test-repo",
                    cloneUrl: "https://bitbucket.gitpod-dev.com/scm/git/gitpod-test-repo.git",
                    webUrl: "https://bitbucket.gitpod-dev.com/projects/GIT/repos/gitpod-test-repo",
                    defaultBranch: "master",
                    private: true,
                    repoKind: "projects",
                },
            },
        });
    }

    @test async test_tag_context_01() {
        const result = await this.parser.handle(
            {},
            this.user,
            "https://bitbucket.gitpod-dev.com/projects/GIT/repos/gitpod-test-repo/browse?at=refs%2Ftags%2Ftest-tag-v1.0.1",
        );

        expect(result).to.deep.include({
            title: "GIT/gitpod-test-repo - test-tag-v1.0.1",
            ref: "test-tag-v1.0.1",
            refType: "tag",
            revision: "506e5aed317f28023994ecf8ca6ed91430e9c1a4",
            repository: {
                host: "bitbucket.gitpod-dev.com",
                owner: "GIT",
                name: "gitpod-test-repo",
                cloneUrl: "https://bitbucket.gitpod-dev.com/scm/git/gitpod-test-repo.git",
                webUrl: "https://bitbucket.gitpod-dev.com/projects/GIT/repos/gitpod-test-repo",
                defaultBranch: "master",
                private: true,
                repoKind: "projects",
            },
        });
    }

    @test test_toSimpleBranchName() {
        const url = new URL(
            "https://bitbucket.gitpod-dev.com/projects/GIT/repos/gitpod-test-repo/browse?at=refs%2Fheads%2Ffoo",
        );
        const branchName = this.parser.toSimpleBranchName(url.searchParams.get("at")!);
        expect(branchName).to.equal("foo");
    }
}

module.exports = new TestBitbucketServerContextParser();
