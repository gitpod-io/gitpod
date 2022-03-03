/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { suite, test, timeout, retries } from 'mocha-typescript';
import * as chai from 'chai';
const expect = chai.expect;

import { GitlabContextParser } from './gitlab-context-parser';
import { User } from '@gitpod/gitpod-protocol';
import { ContainerModule, Container } from 'inversify';
import { DevData } from '../dev/dev-data';
import { GitLabApi, GitLab } from './api';
import { AuthProviderParams } from '../auth/auth-provider';
import { NotFoundError } from '../errors';
import { GitLabTokenHelper } from './gitlab-token-helper';
import { TokenProvider } from '../user/token-provider';
import { HostContextProvider } from '../auth/host-context-provider';
import { skipIfEnvVarNotSet } from '@gitpod/gitpod-protocol/lib/util/skip-if';

@suite(timeout(10000), retries(2), skipIfEnvVarNotSet('GITPOD_TEST_TOKEN_GITLAB'))
class TestGitlabContextParser {
    protected parser: GitlabContextParser;
    protected user: User;

    public before() {
        const container = new Container();
        container.load(
            new ContainerModule((bind, unbind, isBound, rebind) => {
                bind(GitlabContextParser).toSelf().inSingletonScope();
                bind(GitLabApi).toSelf().inSingletonScope();
                bind(AuthProviderParams).toConstantValue(TestGitlabContextParser.AUTH_HOST_CONFIG);
                bind(GitLabTokenHelper).toSelf().inSingletonScope();
                bind(TokenProvider).toConstantValue(<TokenProvider>{
                    getTokenForHost: async () => DevData.createGitlabTestToken(),
                    getFreshPortAuthenticationToken: async (user: User, workspaceId: string) =>
                        DevData.createPortAuthTestToken(workspaceId),
                });
                bind(HostContextProvider).toConstantValue(DevData.createDummyHostContextProvider());
            }),
        );
        this.parser = container.get(GitlabContextParser);
        this.user = DevData.createTestUser();
    }
    static readonly AUTH_HOST_CONFIG: Partial<AuthProviderParams> = {
        id: 'Public-GitLab',
        type: 'GitLab',
        verified: true,
        description: '',
        icon: '',
        host: 'gitlab.com',
    };
    static readonly BLO_BLA_ERROR_DATA = {
        host: 'gitlab.com',
        lastUpdate: undefined,
        owner: 'blo',
        repoName: 'bla',
        userIsOwner: false,
        userScopes: ['read_user', 'api'],
    };

    @test public async testErrorContext_01() {
        try {
            await this.parser.handle({}, this.user, 'https://gitlab.com/blo/bla');
        } catch (e) {
            expect(NotFoundError.is(e));
            expect(e.data).to.deep.equal(TestGitlabContextParser.BLO_BLA_ERROR_DATA);
        }
    }

    @test public async testTreeContext_01() {
        const result = await this.parser.handle({}, this.user, 'https://gitlab.com/AlexTugarev/gp-test');
        expect(result).to.deep.include({
            ref: 'master',
            refType: 'branch',
            path: '',
            isFile: false,
            repository: {
                host: 'gitlab.com',
                owner: 'AlexTugarev',
                name: 'gp-test',
                cloneUrl: 'https://gitlab.com/AlexTugarev/gp-test.git',
                defaultBranch: 'master',
                private: false,
            },
            title: 'AlexTugarev/gp-test - master',
        });
    }

    @test public async testTreeContext_01_regression() {
        const result = await this.parser.handle({}, this.user, 'https://gitlab.com/gitlab-org/gitlab');
        console.log('result');
        expect(result).to.deep.include({
            ref: 'master',
            refType: 'branch',
            path: '',
            isFile: false,
            repository: {
                host: 'gitlab.com',
                owner: 'gitlab-org',
                name: 'gitlab',
                cloneUrl: 'https://gitlab.com/gitlab-org/gitlab.git',
                defaultBranch: 'master',
                private: false,
            },
            title: 'gitlab-org/gitlab - master',
        });
    }

    @test public async testTreeContext_02() {
        const result = await this.parser.handle({}, this.user, 'https://gitlab.com/AlexTugarev/gp-test/tree/wip');
        expect(result).to.deep.include({
            ref: 'wip',
            refType: 'branch',
            path: '',
            revision: '622f8e28d71f40d8f9475a9e44de7c3b03547c9c',
            isFile: false,
            repository: {
                host: 'gitlab.com',
                owner: 'AlexTugarev',
                name: 'gp-test',
                cloneUrl: 'https://gitlab.com/AlexTugarev/gp-test.git',
                defaultBranch: 'master',
                private: false,
            },
            title: 'AlexTugarev/gp-test - wip',
        });
    }

    @test public async testTreeContext_03() {
        const result = await this.parser.handle(
            {},
            this.user,
            'https://gitlab.com/AlexTugarev/gp-test/tree/wip/README.md',
        );
        expect(result).to.deep.include({
            ref: 'wip',
            refType: 'branch',
            path: 'README.md',
            revision: '622f8e28d71f40d8f9475a9e44de7c3b03547c9c',
            isFile: true,
            repository: {
                host: 'gitlab.com',
                owner: 'AlexTugarev',
                name: 'gp-test',
                cloneUrl: 'https://gitlab.com/AlexTugarev/gp-test.git',
                defaultBranch: 'master',
                private: false,
            },
            title: 'AlexTugarev/gp-test - wip',
        });
    }

    @test public async testTreeContext_04() {
        const result = await this.parser.handle({}, this.user, 'https://gitlab.com/AlexTugarev/gp-test/tree/master');
        expect(result).to.deep.include({
            ref: 'master',
            refType: 'branch',
            path: '',
            revision: '3cbb7be8212f00bcbea6a2ff9ae889219b391e63',
            isFile: false,
            repository: {
                host: 'gitlab.com',
                owner: 'AlexTugarev',
                name: 'gp-test',
                cloneUrl: 'https://gitlab.com/AlexTugarev/gp-test.git',
                defaultBranch: 'master',
                private: false,
            },
            title: 'AlexTugarev/gp-test - master',
        });
    }

    @test public async testTreeContext_tag_01() {
        const result = await this.parser.handle({}, this.user, 'https://gitlab.com/AlexTugarev/gp-test/tree/test-tag');
        expect(result).to.deep.include({
            ref: 'test-tag',
            refType: 'tag',
            revision: 'af65de8b249855785bbc7a8073ebcf21f55bc8fb',
            isFile: false,
            repository: {
                host: 'gitlab.com',
                owner: 'AlexTugarev',
                name: 'gp-test',
                cloneUrl: 'https://gitlab.com/AlexTugarev/gp-test.git',
                defaultBranch: 'master',
                private: false,
            },
            title: 'AlexTugarev/gp-test - test-tag',
        });
    }

    @test public async testCommitsContext_01() {
        const result = await this.parser.handle({}, this.user, 'https://gitlab.com/AlexTugarev/gp-test/-/commits/wip');
        expect(result).to.deep.include({
            ref: 'wip',
            refType: 'branch',
            path: '',
            revision: '622f8e28d71f40d8f9475a9e44de7c3b03547c9c',
            isFile: false,
            repository: {
                host: 'gitlab.com',
                owner: 'AlexTugarev',
                name: 'gp-test',
                cloneUrl: 'https://gitlab.com/AlexTugarev/gp-test.git',
                defaultBranch: 'master',
                private: false,
            },
            title: 'AlexTugarev/gp-test - wip',
        });
    }

    @test public async testCommitContext_01() {
        const result = await this.parser.handle(
            {},
            this.user,
            'https://gitlab.com/AlexTugarev/gp-test/-/commit/80948e8cc8f0e851e89a10bc7c2ee234d1a5fbe7',
        );
        expect(result).to.deep.include({
            ref: '',
            refType: 'revision',
            path: '',
            revision: '80948e8cc8f0e851e89a10bc7c2ee234d1a5fbe7',
            isFile: false,
            repository: {
                host: 'gitlab.com',
                owner: 'AlexTugarev',
                name: 'gp-test',
                cloneUrl: 'https://gitlab.com/AlexTugarev/gp-test.git',
                defaultBranch: 'master',
                private: false,
            },
            title: 'AlexTugarev/gp-test - Update /folder/empty.file.jpeg',
        });
    }

    @test public async testCommitContext_02_notExistingCommit() {
        try {
            await this.parser.handle(
                {},
                this.user,
                'https://gitlab.com/AlexTugarev/gp-test/-/commit/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            );
            // ensure that an error has been thrown
            chai.assert.fail();
        } catch (e) {
            if (GitLab.ApiError.is(e)) {
                expect(e.httpError?.description).equals('404 Commit Not Found');
            } else {
                chai.assert.fail('Unknown Error: ' + JSON.stringify(e));
            }
        }
    }

    @test public async testPullRequestContext_01() {
        const result = await this.parser.handle(
            {},
            this.user,
            'https://gitlab.com/AlexTugarev/gp-test/merge_requests/2',
        );
        expect(result).to.deep.include({
            title: 'WIP Awesome Feature',
            repository: {
                host: 'gitlab.com',
                owner: 'AlexTugarev2',
                name: 'gp-test',
                cloneUrl: 'https://gitlab.com/AlexTugarev2/gp-test.git',
                defaultBranch: 'master',
                private: false,
                fork: {
                    parent: {
                        cloneUrl: 'https://gitlab.com/AlexTugarev/gp-test.git',
                        defaultBranch: 'master',
                        host: 'gitlab.com',
                        name: 'gp-test',
                        owner: 'AlexTugarev',
                    },
                },
            },
            ref: 'wip2',
            refType: 'branch',
            revision: '75efd33f61487832325a4864b7c1e14f4e41c9f7',
            nr: 2,
            base: {
                repository: {
                    host: 'gitlab.com',
                    owner: 'AlexTugarev',
                    name: 'gp-test',
                    cloneUrl: 'https://gitlab.com/AlexTugarev/gp-test.git',
                    defaultBranch: 'master',
                    private: false,
                },
                ref: 'master',
                refType: 'branch',
            },
        });
    }

    @test public async testIssueContext_01() {
        const result = await this.parser.handle({}, this.user, 'https://gitlab.com/AlexTugarev/gp-test/issues/1');
        expect(result).to.deep.include({
            title: 'Write a Readme',
            repository: {
                host: 'gitlab.com',
                owner: 'AlexTugarev',
                name: 'gp-test',
                cloneUrl: 'https://gitlab.com/AlexTugarev/gp-test.git',
                defaultBranch: 'master',
                private: false,
            },
            owner: 'AlexTugarev',
            nr: 1,
            ref: 'master',
            refType: 'branch',
            revision: '3cbb7be8212f00bcbea6a2ff9ae889219b391e63',
            localBranch: 'somefox/write-a-readme-1',
        });
    }

    @test public async testTreeContextSubgroup_01() {
        const result = await this.parser.handle(
            {},
            this.user,
            'https://gitlab.com/gp-test-group/gp-test-subgroup/gp-test-project-in-subgroup',
        );
        expect(result).to.deep.include({
            ref: 'master',
            refType: 'branch',
            path: '',
            revision: 'f2e1ef56733e7507f766d8ada01f6570c0f3e921',
            isFile: false,
            repository: {
                host: 'gitlab.com',
                owner: 'gp-test-group/gp-test-subgroup',
                name: 'gp-test-project-in-subgroup',
                cloneUrl: 'https://gitlab.com/gp-test-group/gp-test-subgroup/gp-test-project-in-subgroup.git',
                defaultBranch: 'master',
                private: false,
            },
            title: 'gp-test-group/gp-test-subgroup/gp-test-project-in-subgroup - master',
        });
    }

    @test public async testTreeContextSubgroup_02() {
        const result = await this.parser.handle(
            {},
            this.user,
            'https://gitlab.com/gp-test-group/gp-test-subgroup/gp-test-project-in-subgroup/tree/branchtwo',
        );
        expect(result).to.deep.include({
            ref: 'branchtwo',
            refType: 'branch',
            path: '',
            revision: 'f2e1ef56733e7507f766d8ada01f6570c0f3e921',
            isFile: false,
            repository: {
                host: 'gitlab.com',
                owner: 'gp-test-group/gp-test-subgroup',
                name: 'gp-test-project-in-subgroup',
                cloneUrl: 'https://gitlab.com/gp-test-group/gp-test-subgroup/gp-test-project-in-subgroup.git',
                defaultBranch: 'master',
                private: false,
            },
            title: 'gp-test-group/gp-test-subgroup/gp-test-project-in-subgroup - branchtwo',
        });
    }

    @test public async testTreeContextSubgroup_03() {
        const result = await this.parser.handle(
            {},
            this.user,
            'https://gitlab.com/gp-test-group/gp-test-subgroup/gp-test-project-in-subgroup/tree/branchtwo/README.md',
        );
        expect(result).to.deep.include({
            ref: 'branchtwo',
            refType: 'branch',
            path: 'README.md',
            revision: 'f2e1ef56733e7507f766d8ada01f6570c0f3e921',
            isFile: true,
            repository: {
                host: 'gitlab.com',
                owner: 'gp-test-group/gp-test-subgroup',
                name: 'gp-test-project-in-subgroup',
                cloneUrl: 'https://gitlab.com/gp-test-group/gp-test-subgroup/gp-test-project-in-subgroup.git',
                defaultBranch: 'master',
                private: false,
            },
            title: 'gp-test-group/gp-test-subgroup/gp-test-project-in-subgroup - branchtwo',
        });
    }

    @test public async testTreeContextSubgroup_04() {
        const result = await this.parser.handle(
            {},
            this.user,
            'https://gitlab.com/gp-test-group/gp-test-subgroup/gp-test-project-in-subgroup/tree/master',
        );
        expect(result).to.deep.include({
            ref: 'master',
            refType: 'branch',
            path: '',
            revision: 'f2e1ef56733e7507f766d8ada01f6570c0f3e921',
            isFile: false,
            repository: {
                host: 'gitlab.com',
                owner: 'gp-test-group/gp-test-subgroup',
                name: 'gp-test-project-in-subgroup',
                cloneUrl: 'https://gitlab.com/gp-test-group/gp-test-subgroup/gp-test-project-in-subgroup.git',
                defaultBranch: 'master',
                private: false,
            },
            title: 'gp-test-group/gp-test-subgroup/gp-test-project-in-subgroup - master',
        });
    }

    @test public async testTreeContextSubgroup_05() {
        const result = await this.parser.handle(
            {},
            this.user,
            'https://gitlab.com/gp-test-group/gp-test-subgroup/gp-test-project-in-subgroup/blob/master/test%20dir%20with%20spaces/file%20with%20spaces.txt',
        );
        expect(result).to.deep.include({
            ref: 'master',
            refType: 'branch',
            path: 'test dir with spaces/file with spaces.txt',
            revision: 'f2e1ef56733e7507f766d8ada01f6570c0f3e921',
            isFile: true,
            repository: {
                host: 'gitlab.com',
                owner: 'gp-test-group/gp-test-subgroup',
                name: 'gp-test-project-in-subgroup',
                cloneUrl: 'https://gitlab.com/gp-test-group/gp-test-subgroup/gp-test-project-in-subgroup.git',
                defaultBranch: 'master',
                private: false,
            },
            title: 'gp-test-group/gp-test-subgroup/gp-test-project-in-subgroup - master',
        });
    }

    @test public async testTreeContextSubgroup_tag_01() {
        const result = await this.parser.handle(
            {},
            this.user,
            'https://gitlab.com/gp-test-group/gp-test-subgroup/gp-test-project-in-subgroup/tree/test-tag',
        );
        expect(result).to.deep.include({
            ref: 'test-tag',
            refType: 'tag',
            revision: 'ebc1978ce17df9b2215699960123c4fd301bf5fb',
            isFile: false,
            repository: {
                host: 'gitlab.com',
                owner: 'gp-test-group/gp-test-subgroup',
                name: 'gp-test-project-in-subgroup',
                cloneUrl: 'https://gitlab.com/gp-test-group/gp-test-subgroup/gp-test-project-in-subgroup.git',
                defaultBranch: 'master',
                private: false,
            },
            title: 'gp-test-group/gp-test-subgroup/gp-test-project-in-subgroup - test-tag',
        });
    }

    @test public async testIssueContextSubgroup_01() {
        const result = await this.parser.handle(
            {},
            this.user,
            'https://gitlab.com/gp-test-group/gp-test-subgroup/gp-test-project-in-subgroup/issues/1',
        );
        expect(result).to.deep.include({
            title: 'Important issue',
            repository: {
                host: 'gitlab.com',
                owner: 'gp-test-group/gp-test-subgroup',
                name: 'gp-test-project-in-subgroup',
                cloneUrl: 'https://gitlab.com/gp-test-group/gp-test-subgroup/gp-test-project-in-subgroup.git',
                defaultBranch: 'master',
                private: false,
            },
            owner: 'gp-test-group/gp-test-subgroup',
            nr: 1,
            ref: 'master',
            refType: 'branch',
            revision: 'f2e1ef56733e7507f766d8ada01f6570c0f3e921',
            localBranch: 'somefox/important-issue-1',
        });
    }

    @test public async testTreeContextBranchWithSlash() {
        const result = await this.parser.handle(
            {},
            this.user,
            'https://gitlab.com/gp-test-group/gp-test-subgroup/gp-test-project-in-subgroup/tree/corneliusludmann/important-issue-1',
        );
        expect(result).to.deep.include({
            ref: 'corneliusludmann/important-issue-1',
            refType: 'branch',
            path: '',
            revision: 'd71db0ad147954553233ba66df6f54a2ae7c74bd',
            isFile: false,
            repository: {
                host: 'gitlab.com',
                owner: 'gp-test-group/gp-test-subgroup',
                name: 'gp-test-project-in-subgroup',
                cloneUrl: 'https://gitlab.com/gp-test-group/gp-test-subgroup/gp-test-project-in-subgroup.git',
                defaultBranch: 'master',
                private: false,
            },
            title: 'gp-test-group/gp-test-subgroup/gp-test-project-in-subgroup - corneliusludmann/important-issue-1',
        });
    }

    @test public async testTreeContextBranchWithSlash_NewURLwithDash() {
        const result = await this.parser.handle(
            {},
            this.user,
            'https://gitlab.com/gp-test-group/gp-test-subgroup/gp-test-project-in-subgroup/-/tree/corneliusludmann/important-issue-1',
        );
        expect(result).to.deep.include({
            ref: 'corneliusludmann/important-issue-1',
            refType: 'branch',
            path: '',
            revision: 'd71db0ad147954553233ba66df6f54a2ae7c74bd',
            isFile: false,
            repository: {
                host: 'gitlab.com',
                owner: 'gp-test-group/gp-test-subgroup',
                name: 'gp-test-project-in-subgroup',
                cloneUrl: 'https://gitlab.com/gp-test-group/gp-test-subgroup/gp-test-project-in-subgroup.git',
                defaultBranch: 'master',
                private: false,
            },
            title: 'gp-test-group/gp-test-subgroup/gp-test-project-in-subgroup - corneliusludmann/important-issue-1',
        });
    }

    @test public async testTreeContextTagWithSlash() {
        const result = await this.parser.handle(
            {},
            this.user,
            'https://gitlab.com/gp-test-group/gp-test-subgroup/gp-test-project-in-subgroup/tree/tag/withslash',
        );
        expect(result).to.deep.include({
            ref: 'tag/withslash',
            refType: 'tag',
            revision: 'f2e1ef56733e7507f766d8ada01f6570c0f3e921',
            isFile: false,
            repository: {
                host: 'gitlab.com',
                owner: 'gp-test-group/gp-test-subgroup',
                name: 'gp-test-project-in-subgroup',
                cloneUrl: 'https://gitlab.com/gp-test-group/gp-test-subgroup/gp-test-project-in-subgroup.git',
                defaultBranch: 'master',
                private: false,
            },
            title: 'gp-test-group/gp-test-subgroup/gp-test-project-in-subgroup - tag/withslash',
        });
    }

    @test public async testTreeContextBranchWithSlashAndPathWithSpaces() {
        const result = await this.parser.handle(
            {},
            this.user,
            'https://gitlab.com/gp-test-group/gp-test-subgroup/gp-test-project-in-subgroup/blob/corneliusludmann/important-issue-1/test%20dir%20with%20spaces/file%20with%20spaces.txt',
        );
        expect(result).to.deep.include({
            ref: 'corneliusludmann/important-issue-1',
            refType: 'branch',
            revision: 'd71db0ad147954553233ba66df6f54a2ae7c74bd',
            path: 'test dir with spaces/file with spaces.txt',
            isFile: true,
            repository: {
                host: 'gitlab.com',
                owner: 'gp-test-group/gp-test-subgroup',
                name: 'gp-test-project-in-subgroup',
                cloneUrl: 'https://gitlab.com/gp-test-group/gp-test-subgroup/gp-test-project-in-subgroup.git',
                defaultBranch: 'master',
                private: false,
            },
            title: 'gp-test-group/gp-test-subgroup/gp-test-project-in-subgroup - corneliusludmann/important-issue-1',
        });
    }

    @test public async testTreeContextBranchWithHashSign01() {
        const result = await this.parser.handle(
            {},
            this.user,
            'https://gitlab.com/gp-test-group/gp-test-project/-/tree/feature/%23123-issue',
        );
        expect(result).to.deep.include({
            ref: 'feature/#123-issue',
            refType: 'branch',
            path: '',
            revision: '8b389233c0a3a55a5cd75f89d2c96761420bf2c8',
            isFile: false,
            repository: {
                host: 'gitlab.com',
                owner: 'gp-test-group',
                name: 'gp-test-project',
                cloneUrl: 'https://gitlab.com/gp-test-group/gp-test-project.git',
                defaultBranch: 'master',
                private: false,
            },
            title: 'gp-test-group/gp-test-project - feature/#123-issue',
        });
    }

    @test public async testTreeContextBranchWithHashSign02() {
        const result = await this.parser.handle(
            {},
            this.user,
            'https://gitlab.com/gp-test-group/gp-test-project/-/tree/issue-%23123',
        );
        expect(result).to.deep.include({
            ref: 'issue-#123',
            refType: 'branch',
            path: '',
            revision: '8b389233c0a3a55a5cd75f89d2c96761420bf2c8',
            isFile: false,
            repository: {
                host: 'gitlab.com',
                owner: 'gp-test-group',
                name: 'gp-test-project',
                cloneUrl: 'https://gitlab.com/gp-test-group/gp-test-project.git',
                defaultBranch: 'master',
                private: false,
            },
            title: 'gp-test-group/gp-test-project - issue-#123',
        });
    }

    @test public async testTreeContextBranchWithAndSign() {
        const result = await this.parser.handle(
            {},
            this.user,
            'https://gitlab.com/gp-test-group/gp-test-project/-/tree/another&amp;branch',
        );
        expect(result).to.deep.include({
            ref: 'another&amp;branch',
            refType: 'branch',
            path: '',
            revision: '8b389233c0a3a55a5cd75f89d2c96761420bf2c8',
            isFile: false,
            repository: {
                host: 'gitlab.com',
                owner: 'gp-test-group',
                name: 'gp-test-project',
                cloneUrl: 'https://gitlab.com/gp-test-group/gp-test-project.git',
                defaultBranch: 'master',
                private: false,
            },
            title: 'gp-test-group/gp-test-project - another&amp;branch',
        });
    }

    @test public async testEmptyProject() {
        const result = await this.parser.handle(
            {},
            this.user,
            'https://gitlab.com/gp-test-group/gp-test-empty-project',
        );
        expect(result).to.deep.include({
            isFile: false,
            repository: {
                host: 'gitlab.com',
                owner: 'gp-test-group',
                name: 'gp-test-empty-project',
                cloneUrl: 'https://gitlab.com/gp-test-group/gp-test-empty-project.git',
                private: false,
                defaultBranch: 'main',
            },
            title: 'gp-test-group/gp-test-empty-project - main',
        });
    }

    @test public async testFetchCommitHistory() {
        const result = await this.parser.fetchCommitHistory(
            {},
            this.user,
            'https://gitlab.com/AlexTugarev/gp-test',
            '80948e8cc8f0e851e89a10bc7c2ee234d1a5fbe7',
            100,
        );
        expect(result).to.deep.equal([
            '4447fbc4d46e6fd1ee41fb1b992702521ae078eb',
            'f2d9790f2752a794517b949c65a773eb864844cd',
        ]);
    }
}

module.exports = new TestGitlabContextParser();
