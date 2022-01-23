/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// Use asyncIterators with es2015
if (typeof (Symbol as any).asyncIterator === 'undefined') {
    (Symbol as any).asyncIterator = Symbol.asyncIterator || Symbol('asyncIterator');
}
import "reflect-metadata";

import { suite, test, timeout, retries } from "mocha-typescript";
import * as chai from 'chai';
const expect = chai.expect;

import { BranchRef, GitHubGraphQlEndpoint } from './api';
import { NotFoundError } from '../errors';
import { GithubContextParser } from './github-context-parser';
import { User } from "@gitpod/gitpod-protocol";
import { ContainerModule, Container } from "inversify";
import { Config } from "../config";
import { DevData } from "../dev/dev-data";
import { AuthProviderParams } from "../auth/auth-provider";
import { TokenProvider } from "../user/token-provider";
import { GitHubTokenHelper } from "./github-token-helper";
import { HostContextProvider } from "../auth/host-context-provider";
import { skipIfEnvVarNotSet } from "@gitpod/gitpod-protocol/lib/util/skip-if";

@suite(timeout(10000), retries(2), skipIfEnvVarNotSet("GITPOD_TEST_TOKEN_GITHUB"))
class TestGithubContextParser {

    protected parser: GithubContextParser;
    protected user: User;

    public before() {
        const container = new Container();
        container.load(new ContainerModule((bind, unbind, isBound, rebind) => {
            bind(Config).toConstantValue({
                // meant to appease DI, but Config is never actually used here
            });
            bind(GithubContextParser).toSelf().inSingletonScope();
            bind(GitHubGraphQlEndpoint).toSelf().inSingletonScope();
            bind(AuthProviderParams).toConstantValue(TestGithubContextParser.AUTH_HOST_CONFIG);
            bind(GitHubTokenHelper).toSelf().inSingletonScope();
            bind(TokenProvider).toConstantValue(<TokenProvider>{
                getTokenForHost: async (user: User, host: string) => {
                    return DevData.createGitHubTestToken();
                }
            });
            bind(HostContextProvider).toConstantValue(DevData.createDummyHostContextProvider());
        }));
        this.parser = container.get(GithubContextParser);
        this.user = DevData.createTestUser();
    }

    static readonly AUTH_HOST_CONFIG: Partial<AuthProviderParams> = {
        id: "Public-GitHub",
        type: "GitHub",
        verified: true,
        description: "",
        icon: "",
        host: "github.com",
        oauth: "not-used" as any
    }

    static readonly BRANCH_TEST = {
        name: "test",
        commit: {
            sha: "testsha",
            url: "testurl"
        },
        protected: false,
        protection_url: ""
    };

    static readonly BRANCH_ISSUE_974 = {
        name: "ak/lmcbout-issue_974",
        commit: {
            sha: "sha974",
            url: "url974"
        },
        protected: false,
        protection_url: ""
    };

    static readonly BLO_BLA_ERROR_DATA = {
        host: "github.com",
        lastUpdate: undefined,
        owner: 'blo',
        repoName: 'bla',
        userIsOwner: false,
        userScopes: ["user:email", "public_repo", "repo"],
    };

    protected getTestBranches(): BranchRef[] {
        return [TestGithubContextParser.BRANCH_TEST, TestGithubContextParser.BRANCH_ISSUE_974];
    }

    protected get bloBlaErrorData() {
        return TestGithubContextParser.BLO_BLA_ERROR_DATA;
    }

    @test public async testErrorContext_01() {
        try {
            await this.parser.handle({}, this.user, 'https://github.com/blo/bla');
        } catch (e) {
            expect(NotFoundError.is(e));
            expect(e.data).to.deep.equal(this.bloBlaErrorData);
        }
    }

    @test public async testErrorContext_02() {
        try {
            await this.parser.handle({}, this.user, 'https://github.com/blo/bla/pull/42');
        } catch (e) {
            expect(NotFoundError.is(e));
            expect(e.data).to.deep.equal(this.bloBlaErrorData);
        }
    }

    @test public async testErrorContext_03() {
        try {
            await this.parser.handle({}, this.user, 'https://github.com/blo/bla/issues/42');
        } catch (e) {
            expect(NotFoundError.is(e));
            expect(e.data).to.deep.equal(this.bloBlaErrorData);
        }
    }

    @test public async testErrorContext_04() {
        try {
            await this.parser.handle({}, this.user, 'https://github.com/blo/bla/tree/my/branch/path/foo.ts');
        } catch (e) {
            expect(NotFoundError.is(e));
            expect(e.data).to.deep.equal(this.bloBlaErrorData);
        }
    }

    @test public async testTreeContext_01() {
        const result = await this.parser.handle({}, this.user, 'https://github.com/eclipse-theia/theia');
        expect(result).to.deep.include({
            "ref": "master",
            "refType": "branch",
            "path": "",
            "isFile": false,
            "repository": {
                "host": "github.com",
                "owner": "eclipse-theia",
                "name": "theia",
                "cloneUrl": "https://github.com/eclipse-theia/theia.git",
                "private": false
            },
            "title": "eclipse-theia/theia - master"
        })
    }

    @test public async testTreeContext_02() {
        const result = await this.parser.handle({}, this.user, 'https://github.com/eclipse-theia/theia/tree/master');
        expect(result).to.deep.include({
            "ref": "master",
            "refType": "branch",
            "path": "",
            "isFile": false,
            "repository": {
                "host": "github.com",
                "owner": "eclipse-theia",
                "name": "theia",
                "cloneUrl": "https://github.com/eclipse-theia/theia.git",
                "private": false
            },
            "title": "eclipse-theia/theia - master"
        })
    }

    @test public async testTreeContext_03() {
        const result = await this.parser.handle({}, this.user, 'https://github.com/eclipse-theia/theia/tree/master/LICENSE');
        expect(result).to.deep.include({
            "ref": "master",
            "refType": "branch",
            "path": "LICENSE",
            "isFile": true,
            "repository": {
                "host": "github.com",
                "owner": "eclipse-theia",
                "name": "theia",
                "cloneUrl": "https://github.com/eclipse-theia/theia.git",
                "private": false
            },
            "title": "eclipse-theia/theia - master"
        })
    }

    @test public async testTreeContext_04() {
        const result = await this.parser.handle({}, this.user, 'https://github.com/gitpod-io/gitpod-test-repo/blob/nametest/src/src/server.ts');
        expect(result).to.deep.include({
            "ref": "nametest/src",
            "refType": "branch",
            "path": "src/server.ts",
            "isFile": true,
            "repository": {
                "host": "github.com",
                "owner": "gitpod-io",
                "name": "gitpod-test-repo",
                "cloneUrl": "https://github.com/gitpod-io/gitpod-test-repo.git",
                "private": false
            },
            "title": "gitpod-io/gitpod-test-repo - nametest/src"
        })
    }

    @test public async testTreeContext_05() {
        const result = await this.parser.handle({}, this.user, 'https://github.com/gitpod-io/gitpod-test-repo/tree/499efbbcb50e7e6e5e2883053f72a34cd5396be3/folder1/folder2');
        expect(result).to.deep.include(
            {
                "title": "gitpod-io/gitpod-test-repo - 499efbbc:folder1/folder2",
                "repository": {
                    "host": "github.com",
                    "owner": "gitpod-io",
                    "name": "gitpod-test-repo",
                    "cloneUrl": "https://github.com/gitpod-io/gitpod-test-repo.git",
                    "private": false
                },
                "revision": "499efbbcb50e7e6e5e2883053f72a34cd5396be3",
                "isFile": false,
                "path": "folder1/folder2"
            }
        )
    }

    @test public async testTreeContext_06() {
        const result = await this.parser.handle({}, this.user, 'https://github.com/Snailclimb/JavaGuide/blob/940982ebffa5f376b6baddeaf9ed41c91217a6b6/数据结构与算法/常见安全算法（MD5、SHA1、Base64等等）总结.md');
        expect(result).to.deep.include(
            {
                "title": "Snailclimb/JavaGuide - 940982eb:数据结构与算法/常见安全算法（MD5、SHA1、Base64等等）总结.md",
                "repository": {
                    "host": "github.com",
                    "owner": "Snailclimb",
                    "name": "JavaGuide",
                    "cloneUrl": "https://github.com/Snailclimb/JavaGuide.git",
                    "private": false
                },
                "revision": "940982ebffa5f376b6baddeaf9ed41c91217a6b6",
                "isFile": true,
                "path": "数据结构与算法/常见安全算法（MD5、SHA1、Base64等等）总结.md"
            }
        )
    }

    @test public async testTreeContext_07() {
        const result = await this.parser.handle({}, this.user, 'https://github.com/eclipse-theia/theia#license');
        expect(result).to.deep.include({
            "ref": "master",
            "refType": "branch",
            "path": "",
            "isFile": false,
            "repository": {
                "host": "github.com",
                "owner": "eclipse-theia",
                "name": "theia",
                "cloneUrl": "https://github.com/eclipse-theia/theia.git",
                "private": false
            },
            "title": "eclipse-theia/theia - master"
        })
    }

    @test public async testTreeContext_tag_01() {
        const result = await this.parser.handle({}, this.user, 'https://github.com/eclipse-theia/theia/tree/v0.1.0');
        expect(result).to.deep.include(
            {
                "title": "eclipse-theia/theia - v0.1.0",
                "repository": {
                    "host": "github.com",
                    "owner": "eclipse-theia",
                    "name": "theia",
                    "cloneUrl": "https://github.com/eclipse-theia/theia.git",
                    "private": false
                },
                "revision": "f29626847a14ca50dd78483aebaf4b4fe26bcb73",
                "isFile": false,
                "ref": "v0.1.0",
                "refType": "tag"
            }
        )
    }

    @test public async testReleasesContext_tag_01() {
        const result = await this.parser.handle({}, this.user, 'https://github.com/gitpod-io/gitpod/releases/tag/v0.9.0');
        expect(result).to.deep.include(
            {
                "ref": "v0.9.0",
                "refType": "tag",
                "isFile": false,
                "path": "",
                "title": "gitpod-io/gitpod - v0.9.0",
                "revision": "25ece59c495d525614f28971d41d5708a31bf1e3",
                "repository": {
                    "cloneUrl": "https://github.com/gitpod-io/gitpod.git",
                    "host": "github.com",
                    "name": "gitpod",
                    "owner": "gitpod-io",
                    "private": false
                }
            }
        )
    }

    @test public async testCommitsContext_01() {
        const result = await this.parser.handle({}, this.user, 'https://github.com/gitpod-io/gitpod-test-repo/commits/4test');
        expect(result).to.deep.include({
            "ref": "4test",
            "refType": "branch",
            "path": "",
            "isFile": false,
            "repository": {
                "host": "github.com",
                "owner": "gitpod-io",
                "name": "gitpod-test-repo",
                "cloneUrl": "https://github.com/gitpod-io/gitpod-test-repo.git",
                "private": false
            },
            "title": "gitpod-io/gitpod-test-repo - 4test"
        })
    }

    @test public async testCommitContext_01() {
        const result = await this.parser.handle({}, this.user, 'https://github.com/gitpod-io/gitpod-test-repo/commit/409ac2de49a53d679989d438735f78204f441634');
        expect(result).to.deep.include({
            "ref": "",
            "refType": "revision",
            "path": "",
            "revision": "409ac2de49a53d679989d438735f78204f441634",
            "isFile": false,
            "repository": {
                "host": "github.com",
                "owner": "gitpod-io",
                "name": "gitpod-test-repo",
                "cloneUrl": "https://github.com/gitpod-io/gitpod-test-repo.git",
                "private": false
            },
            "title": "gitpod-io/gitpod-test-repo - Test 3"
        })
    }

    @test public async testCommitContext_02_notExistingCommit() {
        try {
            await this.parser.handle({}, this.user, 'https://github.com/gitpod-io/gitpod-test-repo/commit/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
            // ensure that an error has been thrown
            chai.assert.fail();
        } catch (e) {
            expect(e.message).contains("Couldn't find commit");
        }
    }

    @test public async testCommitContext_02_invalidSha() {
        try {
            await this.parser.handle({}, this.user, 'https://github.com/gitpod-io/gitpod-test-repo/commit/invalid');
            // ensure that an error has been thrown
            chai.assert.fail();
        } catch (e) {
            expect(e.message).contains("Invalid commit ID");
        }
    }

    @test public async testPullRequestContext_01() {
        const result = await this.parser.handle({}, this.user, 'https://github.com/TypeFox/theia/pull/1');
        expect(result).to.deep.include(
            {
                "title": "Merge master",
                "repository": {
                    "host": "github.com",
                    "owner": "eclipse-theia",
                    "name": "theia",
                    "cloneUrl": "https://github.com/eclipse-theia/theia.git",
                    "private": false
                },
                "ref": "master",
                "refType": "branch",
                "nr": 1,
                "base": {
                    "repository": {
                        "host": "github.com",
                        "owner": "TypeFox",
                        "name": "theia",
                        "cloneUrl": "https://github.com/TypeFox/theia.git",
                        "private": false,
                        "fork": {
                            "parent": {
                                "cloneUrl": "https://github.com/eclipse-theia/theia.git",
                                "host": "github.com",
                                "name": "theia",
                                "owner": "eclipse-theia",
                                "private": false
                            }
                        }
                    },
                    "ref": "master",
                    "refType": "branch",
                }
            }
        )
    }

    @test public async testPullRequestthroughIssueContext_04() {
        const result = await this.parser.handle({}, this.user, 'https://github.com/TypeFox/theia/issues/1');
        expect(result).to.deep.include(
            {
                "title": "Merge master",
                "repository": {
                    "host": "github.com",
                    "owner": "eclipse-theia",
                    "name": "theia",
                    "cloneUrl": "https://github.com/eclipse-theia/theia.git",
                    "private": false
                },
                "ref": "master",
                "refType": "branch",
                "nr": 1,
                "base": {
                    "repository": {
                        "host": "github.com",
                        "owner": "TypeFox",
                        "name": "theia",
                        "cloneUrl": "https://github.com/TypeFox/theia.git",
                        "private": false,
                        "fork": {
                            "parent": {
                                "cloneUrl": "https://github.com/eclipse-theia/theia.git",
                                "host": "github.com",
                                "name": "theia",
                                "owner": "eclipse-theia",
                                "private": false
                            }
                        }
                    },
                    "ref": "master",
                    "refType": "branch",
                }
            }
        )
    }

    @test public async testIssueContext_01() {
        const result = await this.parser.handle({}, this.user, 'https://github.com/gitpod-io/gitpod-test-repo/issues/42');
        expect(result).to.deep.include(
            {
                "title": "Test issue web-extension",
                "repository": {
                    "host": "github.com",
                    "owner": "gitpod-io",
                    "name": "gitpod-test-repo",
                    "cloneUrl": "https://github.com/gitpod-io/gitpod-test-repo.git",
                    "private": false
                },
                "owner": "gitpod-io",
                "nr": 42,
                "ref": "1test",
                "refType": "branch",
                "localBranch": "somefox/test-issue-web-extension-42"
            }
        )
    }

    @test public async testIssuePageContext() {
        const result = await this.parser.handle({}, this.user, 'https://github.com/gitpod-io/gitpod-test-repo/issues');
        expect(result).to.deep.include(
            {
                "title": "gitpod-io/gitpod-test-repo - 1test",
                "repository": {
                    "host": "github.com",
                    "owner": "gitpod-io",
                    "name": "gitpod-test-repo",
                    "cloneUrl": "https://github.com/gitpod-io/gitpod-test-repo.git",
                    "private": false
                },
                "ref": "1test",
                "refType": "branch",
            }
        )
    }


    @test public async testIssueThroughPullRequestContext() {
        const result = await this.parser.handle({}, this.user, 'https://github.com/gitpod-io/gitpod-test-repo/pull/42');
        expect(result).to.deep.include(
            {
                "title": "Test issue web-extension",
                "repository": {
                    "host": "github.com",
                    "owner": "gitpod-io",
                    "name": "gitpod-test-repo",
                    "cloneUrl": "https://github.com/gitpod-io/gitpod-test-repo.git",
                    "private": false
                },
                "owner": "gitpod-io",
                "nr": 42,
                "ref": "1test",
                "refType": "branch",
                "localBranch": "somefox/test-issue-web-extension-42"
            }
        )
    }

    @test public async testBlobContext_01() {
        const result = await this.parser.handle({}, this.user, 'https://github.com/gitpod-io/gitpod-test-repo/blob/aba298d5084a817cdde3dd1f26692bc2a216e2b9/test-comment-01.md');
        expect(result).to.deep.include(
            {
                "title": "gitpod-io/gitpod-test-repo - aba298d5:test-comment-01.md",
                "repository": {
                    "host": "github.com",
                    "owner": "gitpod-io",
                    "name": "gitpod-test-repo",
                    "cloneUrl": "https://github.com/gitpod-io/gitpod-test-repo.git",
                    "private": false
                },
                "revision": "aba298d5084a817cdde3dd1f26692bc2a216e2b9",
                "isFile": true,
                "path": "test-comment-01.md"
            }
        )
    }

    @test public async testBlobContext_02() {
        const result = await this.parser.handle({}, this.user, 'https://github.com/gitpod-io/gitpod-test-repo/blob/499efbbcb50e7e6e5e2883053f72a34cd5396be3/folder1/folder2/content2');
        expect(result).to.deep.include(
            {
                "title": "gitpod-io/gitpod-test-repo - 499efbbc:folder1/folder2/content2",
                "repository": {
                    "host": "github.com",
                    "owner": "gitpod-io",
                    "name": "gitpod-test-repo",
                    "cloneUrl": "https://github.com/gitpod-io/gitpod-test-repo.git",
                    "private": false
                },
                "revision": "499efbbcb50e7e6e5e2883053f72a34cd5396be3",
                "isFile": true,
                "path": "folder1/folder2/content2"
            }
        )
    }

    @test public async testBlobContextShort_01() {
        const result = await this.parser.handle({}, this.user, 'https://github.com/gitpod-io/gitpod-test-repo/blob/499efbbc/folder1/folder2/content2');
        expect(result).to.deep.include(
            {
                "title": "gitpod-io/gitpod-test-repo - 499efbbc:folder1/folder2/content2",
                "repository": {
                    "host": "github.com",
                    "owner": "gitpod-io",
                    "name": "gitpod-test-repo",
                    "cloneUrl": "https://github.com/gitpod-io/gitpod-test-repo.git",
                    "private": false
                },
                "revision": "499efbbcb50e7e6e5e2883053f72a34cd5396be3",
                "isFile": true,
                "path": "folder1/folder2/content2"
            }
        )
    }

    @test public async testBlobContextShort_02() {
        const result = await this.parser.handle({}, this.user, 'https://github.com/gitpod-io/gitpod-test-repo/blob/499ef/folder1/folder2/content2');
        expect(result).to.deep.include(
            {
                "title": "gitpod-io/gitpod-test-repo - 499efbbc:folder1/folder2/content2",
                "repository": {
                    "host": "github.com",
                    "owner": "gitpod-io",
                    "name": "gitpod-test-repo",
                    "cloneUrl": "https://github.com/gitpod-io/gitpod-test-repo.git",
                    "private": false
                },
                "revision": "499efbbcb50e7e6e5e2883053f72a34cd5396be3",
                "isFile": true,
                "path": "folder1/folder2/content2"
            }
        )
    }
}
module.exports = new TestGithubContextParser()   // Only to circumvent no usage warning :-/