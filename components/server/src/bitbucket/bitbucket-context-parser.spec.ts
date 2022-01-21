/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { User } from '@gitpod/gitpod-protocol';
import * as chai from 'chai';
import { Container, ContainerModule } from 'inversify';
import { suite, test, timeout } from 'mocha-typescript';
import { AuthProviderParams } from '../auth/auth-provider';
import { HostContextProvider } from '../auth/host-context-provider';
import { DevData } from '../dev/dev-data';
import { TokenProvider } from '../user/token-provider';
import { BitbucketApiFactory, BasicAuthBitbucketApiFactory } from './bitbucket-api-factory';
import { BitbucketContextParser } from './bitbucket-context-parser';
import { BitbucketTokenHelper } from './bitbucket-token-handler';
const expect = chai.expect;
import { skipIfEnvVarNotSet } from '@gitpod/gitpod-protocol/lib/util/skip-if';

@suite(timeout(10000), skipIfEnvVarNotSet('GITPOD_TEST_TOKEN_BITBUCKET'))
class TestBitbucketContextParser {
  protected parser: BitbucketContextParser;
  protected user: User;

  static readonly AUTH_HOST_CONFIG: Partial<AuthProviderParams> = {
    id: 'Public-Bitbucket',
    type: 'Bitbucket',
    verified: true,
    description: '',
    icon: '',
    host: 'bitbucket.org',
    oauth: {
      callBackUrl: '',
      clientId: 'not-used',
      clientSecret: '',
      tokenUrl: '',
      scope: '',
      authorizationUrl: '',
    },
  };

  public before() {
    const container = new Container();
    container.load(
      new ContainerModule((bind, unbind, isBound, rebind) => {
        bind(BitbucketContextParser).toSelf().inSingletonScope();
        bind(AuthProviderParams).toConstantValue(TestBitbucketContextParser.AUTH_HOST_CONFIG);
        bind(BitbucketTokenHelper).toSelf().inSingletonScope();
        bind(TokenProvider).toConstantValue(<TokenProvider>{
          getTokenForHost: async () => DevData.createBitbucketTestToken(),
          getFreshPortAuthenticationToken: async (user: User, workspaceId: string) =>
            DevData.createPortAuthTestToken(workspaceId),
        });
        bind(BitbucketApiFactory).to(BasicAuthBitbucketApiFactory).inSingletonScope();
        bind(HostContextProvider).toConstantValue({
          get: (hostname: string) => {
            authProvider: {
              ('Public-Bitbucket');
            }
          },
        });
      }),
    );
    this.parser = container.get(BitbucketContextParser);
    this.user = DevData.createTestUser();
  }

  @test public testCanHandleBitbucketRepo() {
    expect(this.parser.canHandle(this.user, 'https://bitbucket.org/gitpod/integration-tests/src/master/')).to.be.true;
  }

  @test public testCanNotHandleGitHubRepo() {
    expect(this.parser.canHandle(this.user, 'https://github.com/eclipse-theia/theia')).to.be.false;
  }

  @test public async testShortContext_01() {
    const result = await this.parser.handle({}, this.user, 'https://bitbucket.org/gitpod/integration-tests');
    expect(result).to.deep.include({
      ref: 'master',
      refType: 'branch',
      path: '',
      revision: 'da2119f51b0e744cb6b36399f8433b477a4174ef',
      isFile: false,
      repository: {
        host: 'bitbucket.org',
        owner: 'gitpod',
        name: 'integration-tests',
        cloneUrl: 'https://bitbucket.org/gitpod/integration-tests.git',
        defaultBranch: 'master',
        private: false,
      },
      title: 'gitpod/integration-tests - master',
    });
  }

  @test public async testSrcContext_01() {
    const result = await this.parser.handle(
      {},
      this.user,
      'https://bitbucket.org/gitpod/integration-tests/src/master/',
    );
    expect(result).to.deep.include({
      ref: 'master',
      refType: 'branch',
      path: '',
      revision: 'da2119f51b0e744cb6b36399f8433b477a4174ef',
      isFile: false,
      repository: {
        host: 'bitbucket.org',
        owner: 'gitpod',
        name: 'integration-tests',
        cloneUrl: 'https://bitbucket.org/gitpod/integration-tests.git',
        defaultBranch: 'master',
        private: false,
      },
      title: 'gitpod/integration-tests - master',
    });
  }

  @test public async testSrcContext_02() {
    const result = await this.parser.handle(
      {},
      this.user,
      'https://bitbucket.org/gitpod/integration-tests/src/8fcf6c869d0cdb570bb6f2f9aa5f8ed72c9d953a/?at=Gitpod%2Ftesttxt-created-online-with-bitbucket-1589277871983',
    );
    expect(result).to.deep.include({
      ref: 'Gitpod/testtxt-created-online-with-bitbucket-1589277871983',
      refType: 'branch',
      path: '',
      revision: '8fcf6c869d0cdb570bb6f2f9aa5f8ed72c9d953a',
      isFile: false,
      repository: {
        host: 'bitbucket.org',
        owner: 'gitpod',
        name: 'integration-tests',
        cloneUrl: 'https://bitbucket.org/gitpod/integration-tests.git',
        defaultBranch: 'master',
        private: false,
      },
      title: 'gitpod/integration-tests - Gitpod/testtxt-created-online-with-bitbucket-1589277871983',
    });
  }

  @test public async testSrcContext_03() {
    const result = await this.parser.handle(
      {},
      this.user,
      'https://bitbucket.org/gitpod/integration-tests/src/second-branch/',
    );
    expect(result).to.deep.include({
      ref: 'second-branch',
      refType: 'branch',
      path: '',
      revision: '5a24a0c8a7b42c2e6418593d788e17cb987bda25',
      isFile: false,
      repository: {
        host: 'bitbucket.org',
        owner: 'gitpod',
        name: 'integration-tests',
        cloneUrl: 'https://bitbucket.org/gitpod/integration-tests.git',
        defaultBranch: 'master',
        private: false,
      },
      title: 'gitpod/integration-tests - second-branch',
    });
  }

  @test public async testCommitsContext_01() {
    const result = await this.parser.handle(
      {},
      this.user,
      'https://bitbucket.org/gitpod/integration-tests/commits/branch/second-branch',
    );
    expect(result).to.deep.include({
      ref: 'second-branch',
      refType: 'branch',
      path: '',
      revision: '5a24a0c8a7b42c2e6418593d788e17cb987bda25',
      isFile: false,
      repository: {
        host: 'bitbucket.org',
        owner: 'gitpod',
        name: 'integration-tests',
        cloneUrl: 'https://bitbucket.org/gitpod/integration-tests.git',
        defaultBranch: 'master',
        private: false,
      },
      title: 'gitpod/integration-tests - second-branch',
    });
  }

  @test public async testBranchContext_01() {
    const result = await this.parser.handle(
      {},
      this.user,
      'https://bitbucket.org/gitpod/integration-tests/branch/master/',
    );
    expect(result).to.deep.include({
      ref: 'master',
      refType: 'branch',
      path: '',
      revision: 'da2119f51b0e744cb6b36399f8433b477a4174ef',
      isFile: false,
      repository: {
        host: 'bitbucket.org',
        owner: 'gitpod',
        name: 'integration-tests',
        cloneUrl: 'https://bitbucket.org/gitpod/integration-tests.git',
        defaultBranch: 'master',
        private: false,
      },
      title: 'gitpod/integration-tests - master',
    });
  }

  @test public async testBranchContext_02() {
    const result = await this.parser.handle(
      {},
      this.user,
      'https://bitbucket.org/gitpod/integration-tests/branch/second-branch',
    );
    expect(result).to.deep.include({
      ref: 'second-branch',
      refType: 'branch',
      path: '',
      revision: '5a24a0c8a7b42c2e6418593d788e17cb987bda25',
      isFile: false,
      repository: {
        host: 'bitbucket.org',
        owner: 'gitpod',
        name: 'integration-tests',
        cloneUrl: 'https://bitbucket.org/gitpod/integration-tests.git',
        defaultBranch: 'master',
        private: false,
      },
      title: 'gitpod/integration-tests - second-branch',
    });
  }

  @test public async testBranchContext_03() {
    const result = await this.parser.handle(
      {},
      this.user,
      'https://bitbucket.org/gitpod/integration-tests/branch/feature/JIRA-123-summary',
    );
    expect(result).to.deep.include({
      ref: 'feature/JIRA-123-summary',
      refType: 'branch',
      path: '',
      revision: 'bcf3a4b9329385b7a5f50a4490b79570da029cf3',
      isFile: false,
      repository: {
        host: 'bitbucket.org',
        owner: 'gitpod',
        name: 'integration-tests',
        cloneUrl: 'https://bitbucket.org/gitpod/integration-tests.git',
        defaultBranch: 'master',
        private: false,
      },
      title: 'gitpod/integration-tests - feature/JIRA-123-summary',
    });
  }

  @test public async testCommitsContext_02() {
    const result = await this.parser.handle(
      {},
      this.user,
      'https://bitbucket.org/gitpod/integration-tests/commits/tag/first-tag',
    );
    expect(result).to.deep.include({
      ref: 'first-tag',
      refType: 'tag',
      path: '',
      revision: 'da2119f51b0e744cb6b36399f8433b477a4174ef',
      isFile: false,
      repository: {
        host: 'bitbucket.org',
        owner: 'gitpod',
        name: 'integration-tests',
        cloneUrl: 'https://bitbucket.org/gitpod/integration-tests.git',
        defaultBranch: 'master',
        private: false,
      },
      title: 'gitpod/integration-tests - first-tag',
    });
  }

  @test public async testSrcContext_04() {
    const result = await this.parser.handle(
      {},
      this.user,
      'https://bitbucket.org/gitpod/integration-tests/src/first-tag/',
    );
    expect(result).to.deep.include({
      ref: 'first-tag',
      refType: 'tag',
      path: '',
      revision: 'da2119f51b0e744cb6b36399f8433b477a4174ef',
      isFile: false,
      repository: {
        host: 'bitbucket.org',
        owner: 'gitpod',
        name: 'integration-tests',
        cloneUrl: 'https://bitbucket.org/gitpod/integration-tests.git',
        defaultBranch: 'master',
        private: false,
      },
      title: 'gitpod/integration-tests - first-tag',
    });
  }

  @test public async testCommitsContext_03() {
    const result = await this.parser.handle(
      {},
      this.user,
      'https://bitbucket.org/gitpod/integration-tests/commits/5a24a0c8a7b42c2e6418593d788e17cb987bda25',
    );
    expect(result).to.deep.include({
      ref: '',
      refType: 'revision',
      path: '',
      revision: '5a24a0c8a7b42c2e6418593d788e17cb987bda25',
      isFile: false,
      repository: {
        host: 'bitbucket.org',
        owner: 'gitpod',
        name: 'integration-tests',
        cloneUrl: 'https://bitbucket.org/gitpod/integration-tests.git',
        defaultBranch: 'master',
        private: false,
      },
      title: 'gitpod/integration-tests - 5a24a0c8a7b42c2e6418593d788e17cb987bda25',
    });
  }

  @test public async testFileContext_01() {
    const result = await this.parser.handle(
      {},
      this.user,
      'https://bitbucket.org/gitpod/integration-tests/src/master/README.md',
    );
    expect(result).to.deep.include({
      ref: 'master',
      refType: 'branch',
      path: 'README.md',
      revision: 'da2119f51b0e744cb6b36399f8433b477a4174ef',
      isFile: true,
      repository: {
        host: 'bitbucket.org',
        owner: 'gitpod',
        name: 'integration-tests',
        cloneUrl: 'https://bitbucket.org/gitpod/integration-tests.git',
        defaultBranch: 'master',
        private: false,
      },
      title: 'gitpod/integration-tests - master:README.md',
    });
  }

  @test public async testFileContext_02() {
    const result = await this.parser.handle(
      {},
      this.user,
      'https://bitbucket.org/gitpod/integration-tests/src/branch-with-dir/my-dir/test.txt',
    );
    expect(result).to.deep.include({
      ref: 'branch-with-dir',
      refType: 'branch',
      path: 'my-dir/test.txt',
      revision: '9c49d2042088bdc514d57314fb8a8a8382b9f47f',
      isFile: true,
      repository: {
        host: 'bitbucket.org',
        owner: 'gitpod',
        name: 'integration-tests',
        cloneUrl: 'https://bitbucket.org/gitpod/integration-tests.git',
        defaultBranch: 'master',
        private: false,
      },
      title: 'gitpod/integration-tests - branch-with-dir:my-dir/test.txt',
    });
  }

  @test public async testDirectoryContext_01() {
    const result = await this.parser.handle(
      {},
      this.user,
      'https://bitbucket.org/gitpod/integration-tests/src/branch-with-dir/my-dir/',
    );
    expect(result).to.deep.include({
      ref: 'branch-with-dir',
      refType: 'branch',
      path: 'my-dir',
      revision: '9c49d2042088bdc514d57314fb8a8a8382b9f47f',
      isFile: false,
      repository: {
        host: 'bitbucket.org',
        owner: 'gitpod',
        name: 'integration-tests',
        cloneUrl: 'https://bitbucket.org/gitpod/integration-tests.git',
        defaultBranch: 'master',
        private: false,
      },
      title: 'gitpod/integration-tests - branch-with-dir:my-dir',
    });
  }

  @test public async testPullRequestContext_01() {
    const result = await this.parser.handle(
      {},
      this.user,
      'https://bitbucket.org/gitpod/integration-tests/pull-requests/1/readme-updated/diff',
    );
    expect(result).to.deep.include({
      title: 'Readme updated',
      repository: {
        host: 'bitbucket.org',
        owner: 'gitpod',
        name: 'integration-tests',
        cloneUrl: 'https://bitbucket.org/gitpod/integration-tests.git',
        defaultBranch: 'master',
        private: false,
      },
      ref: 'second-branch',
      refType: 'branch',
      revision: '5a24a0c8a7b4',
      nr: 1,
      base: {
        repository: {
          host: 'bitbucket.org',
          owner: 'gitpod',
          name: 'integration-tests',
          cloneUrl: 'https://bitbucket.org/gitpod/integration-tests.git',
          defaultBranch: 'master',
          private: false,
        },
        ref: 'master',
        refType: 'branch',
      },
    });
  }

  @test public async testPullRequestContext_02() {
    const result = await this.parser.handle(
      {},
      this.user,
      'https://bitbucket.org/gitpod/integration-tests/pull-requests/3/say-hello-to-gitpod/diff',
    );
    expect(result).to.deep.include({
      title: 'Say Hello to Gitpod',
      repository: {
        host: 'bitbucket.org',
        owner: 'corneliusltf',
        name: 'sample-repository',
        cloneUrl: 'https://bitbucket.org/corneliusltf/sample-repository.git',
        defaultBranch: 'master',
        private: false,
        fork: {
          parent: {
            cloneUrl: 'https://bitbucket.org/gitpod/integration-tests.git',
            defaultBranch: 'master',
            host: 'bitbucket.org',
            name: 'integration-tests',
            owner: 'gitpod',
            private: false,
          },
        },
      },
      ref: 'master',
      refType: 'branch',
      revision: '1329535b3ed7',
      nr: 3,
      base: {
        repository: {
          host: 'bitbucket.org',
          owner: 'gitpod',
          name: 'integration-tests',
          cloneUrl: 'https://bitbucket.org/gitpod/integration-tests.git',
          defaultBranch: 'master',
          private: false,
        },
        ref: 'master',
        refType: 'branch',
      },
    });
  }

  @test public async testIssueContext_01() {
    const result = await this.parser.handle(
      {},
      this.user,
      'https://bitbucket.org/gitpod/integration-tests/issues/1/first-issue',
    );
    expect(result).to.deep.include({
      title: 'First issue',
      repository: {
        host: 'bitbucket.org',
        owner: 'gitpod',
        name: 'integration-tests',
        cloneUrl: 'https://bitbucket.org/gitpod/integration-tests.git',
        defaultBranch: 'master',
        private: false,
      },
      owner: 'gitpod',
      nr: 1,
      ref: 'master',
      refType: 'branch',
      localBranch: 'somefox/first-issue-1',
    });
  }

  @test public async testSrcContextForkedRepo_01() {
    const result = await this.parser.handle(
      {},
      this.user,
      'https://bitbucket.org/gitpod/integration-tests-forked-repository/src/master/',
    );
    expect(result).to.deep.include({
      ref: 'master',
      refType: 'branch',
      path: '',
      revision: '3f1c8403570427170bd3776cfb3aa24c688c2b29',
      isFile: false,
      repository: {
        host: 'bitbucket.org',
        owner: 'gitpod',
        name: 'integration-tests-forked-repository',
        cloneUrl: 'https://bitbucket.org/gitpod/integration-tests-forked-repository.git',
        defaultBranch: 'master',
        private: false,
        fork: {
          parent: {
            cloneUrl: 'https://bitbucket.org/corneliusludmann/my-sample-repo.git',
            defaultBranch: 'master',
            host: 'bitbucket.org',
            name: 'my-sample-repo',
            owner: 'corneliusludmann',
            private: false,
          },
        },
      },
      title: 'gitpod/integration-tests-forked-repository - master',
    });
  }

  @test public async testFetchCommitHistory() {
    const result = await this.parser.fetchCommitHistory(
      {},
      this.user,
      'https://bitbucket.org/gitpod/integration-tests',
      'dd0aef8097a7c521b8adfced795fcf96c9e598ef',
      100,
    );
    expect(result).to.deep.equal(['da2119f51b0e744cb6b36399f8433b477a4174ef']);
  }
}

module.exports = new TestBitbucketContextParser();
