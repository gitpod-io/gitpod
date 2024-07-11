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
        host: "bitbucket.gitpod-self-hosted.com",
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
            "https://bitbucket.gitpod-self-hosted.com/projects/FOO/repos/repo123",
        );

        expect(result).to.deep.include({
            ref: "master",
            refType: "branch",
            revision: "9eea1cca9bb98f0caf7ae77c740d5d24548ff33c",
            path: "",
            isFile: false,
            repository: {
                host: "bitbucket.gitpod-self-hosted.com",
                owner: "FOO",
                name: "repo123",
                cloneUrl: "https://bitbucket.gitpod-self-hosted.com/scm/foo/repo123.git",
                webUrl: "https://bitbucket.gitpod-self-hosted.com/projects/FOO/repos/repo123",
                defaultBranch: "master",
                private: true,
                repoKind: "projects",
            },
            title: "FOO/repo123 - master",
        });
    }

    @test async test_tree_context_02() {
        const result = await this.parser.handle(
            {},
            this.user,
            "https://bitbucket.gitpod-self-hosted.com/scm/foo/repo123.git",
        );

        expect(result).to.deep.include({
            ref: "master",
            refType: "branch",
            revision: "9eea1cca9bb98f0caf7ae77c740d5d24548ff33c",
            path: "",
            isFile: false,
            repository: {
                host: "bitbucket.gitpod-self-hosted.com",
                owner: "FOO",
                name: "repo123",
                cloneUrl: "https://bitbucket.gitpod-self-hosted.com/scm/foo/repo123.git",
                webUrl: "https://bitbucket.gitpod-self-hosted.com/projects/FOO/repos/repo123",
                defaultBranch: "master",
                private: true,
                repoKind: "projects",
            },
            title: "foo/repo123 - master",
        });
    }

    @test async test_tree_context_03() {
        const result = await this.parser.handle(
            {},
            this.user,
            "https://bitbucket.gitpod-self-hosted.com/scm/~alextugarev/tada.git",
        );

        expect(result).to.deep.include({
            ref: "main",
            refType: "branch",
            revision: "d4bdb1459f9fc90756154bdda5eb23c39457a89c",
            path: "",
            isFile: false,
            repository: {
                host: "bitbucket.gitpod-self-hosted.com",
                owner: "alextugarev",
                name: "tada",
                cloneUrl: "https://bitbucket.gitpod-self-hosted.com/scm/~alextugarev/tada.git",
                webUrl: "https://bitbucket.gitpod-self-hosted.com/users/alextugarev/repos/tada",
                defaultBranch: "main",
                private: true,
                repoKind: "users",
            },
            title: "alextugarev/tada - main",
        });
    }

    @test async test_commit_context_01() {
        const result = await this.parser.handle(
            {},
            this.user,
            "https://bitbucket.gitpod-self-hosted.com/users/jan/repos/yolo/commits/ec15264e536e9684034ea8e08f3afc3fd485b613",
        );

        expect(result).to.deep.include({
            refType: "revision",
            revision: "ec15264e536e9684034ea8e08f3afc3fd485b613",
            path: "",
            isFile: false,
            repository: {
                cloneUrl: "https://bitbucket.gitpod-self-hosted.com/scm/~jan/yolo.git",
                defaultBranch: "master",
                host: "bitbucket.gitpod-self-hosted.com",
                name: "YOLO",
                owner: "jan",
                private: true,
                repoKind: "users",
                webUrl: "https://bitbucket.gitpod-self-hosted.com/users/jan/repos/yolo",
            },
            title: "jan/yolo - ec15264e536e9684034ea8e08f3afc3fd485b613",
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
            "https://bitbucket.gitpod-self-hosted.com/projects/FOO/repos/repo123/pull-requests/1/commits",
        );

        expect(result).to.deep.include({
            title: "Let's do it",
            nr: 1,
            ref: "foo",
            refType: "branch",
            revision: "1384b6842d73b8705feaf45f3e8aa41f00529042",
            repository: {
                host: "bitbucket.gitpod-self-hosted.com",
                owner: "FOO",
                name: "repo123",
                cloneUrl: "https://bitbucket.gitpod-self-hosted.com/scm/foo/repo123.git",
                webUrl: "https://bitbucket.gitpod-self-hosted.com/projects/FOO/repos/repo123",
                defaultBranch: "master",
                private: true,
                repoKind: "projects",
            },
            base: {
                ref: "master",
                refType: "branch",
                repository: {
                    host: "bitbucket.gitpod-self-hosted.com",
                    owner: "FOO",
                    name: "repo123",
                    cloneUrl: "https://bitbucket.gitpod-self-hosted.com/scm/foo/repo123.git",
                    webUrl: "https://bitbucket.gitpod-self-hosted.com/projects/FOO/repos/repo123",
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
            "https://bitbucket.gitpod-self-hosted.com/projects/FOO/repos/repo123/pull-requests/2/overview",
        );

        expect(result).to.deep.include({
            title: "Let's do it again",
            nr: 2,
            ref: "foo",
            refType: "branch",
            revision: "1384b6842d73b8705feaf45f3e8aa41f00529042",
            repository: {
                host: "bitbucket.gitpod-self-hosted.com",
                owner: "LAL",
                name: "repo123",
                cloneUrl: "https://bitbucket.gitpod-self-hosted.com/scm/lal/repo123.git",
                webUrl: "https://bitbucket.gitpod-self-hosted.com/projects/LAL/repos/repo123",
                defaultBranch: "master",
                private: true,
                repoKind: "projects",
            },
            base: {
                ref: "master",
                refType: "branch",
                repository: {
                    host: "bitbucket.gitpod-self-hosted.com",
                    owner: "FOO",
                    name: "repo123",
                    cloneUrl: "https://bitbucket.gitpod-self-hosted.com/scm/foo/repo123.git",
                    webUrl: "https://bitbucket.gitpod-self-hosted.com/projects/FOO/repos/repo123",
                    defaultBranch: "master",
                    private: true,
                    repoKind: "projects",
                },
            },
        });
    }

    @test async test_PR_context_03() {
        const result = await this.parser.handle(
            {},
            this.user,
            "https://bitbucket.gitpod-self-hosted.com/projects/LAL/repos/repo123/pull-requests/1/overview",
        );

        expect(result).to.deep.include({
            title: "U turn",
            nr: 1,
            ref: "foo",
            refType: "branch",
            revision: "1384b6842d73b8705feaf45f3e8aa41f00529042",
            repository: {
                host: "bitbucket.gitpod-self-hosted.com",
                owner: "FOO",
                name: "repo123",
                cloneUrl: "https://bitbucket.gitpod-self-hosted.com/scm/foo/repo123.git",
                webUrl: "https://bitbucket.gitpod-self-hosted.com/projects/FOO/repos/repo123",
                defaultBranch: "master",
                private: true,
                repoKind: "projects",
            },
            base: {
                ref: "master",
                refType: "branch",
                repository: {
                    host: "bitbucket.gitpod-self-hosted.com",
                    owner: "LAL",
                    name: "repo123",
                    cloneUrl: "https://bitbucket.gitpod-self-hosted.com/scm/lal/repo123.git",
                    webUrl: "https://bitbucket.gitpod-self-hosted.com/projects/LAL/repos/repo123",
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
            "https://bitbucket.gitpod-dev.com/users/filip/repos/repodepo/browse?at=refs%2Ftags%2Fv0.0.1",
        );

        expect(result).to.deep.include({
            title: "filip/repodepo - v0.0.1",
            ref: "v0.0.1",
            refType: "tag",
            revision: "c16d4d0049545e7d8908302c07550f9d325fbed4",
            repository: {
                host: "bitbucket.gitpod-dev.com",
                owner: "filip",
                name: "RepoDepo",
                cloneUrl: "https://bitbucket.gitpod-dev.com/scm/~filip/repodepo.git",
                webUrl: "https://bitbucket.gitpod-dev.com/users/filip/repos/repodepo",
                defaultBranch: "main",
                private: true,
                repoKind: "users",
            },
        });
    }

    @test test_toSimpleBranchName() {
        const url = new URL(
            "https://bitbucket.gitpod-self-hosted.com/projects/FOO/repos/repo123/browse?at=refs%2Fheads%2Ffoo",
        );
        const branchName = this.parser.toSimpleBranchName(url.searchParams.get("at")!);
        expect(branchName).to.equal("foo");
    }
}

module.exports = new TestBitbucketServerContextParser();
