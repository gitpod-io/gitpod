/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Repository, User } from '@gitpod/gitpod-protocol';
import * as chai from 'chai';
import { Container, ContainerModule } from 'inversify';
import { retries, suite, test, timeout } from 'mocha-typescript';
import { AuthProviderParams } from '../auth/auth-provider';
import { HostContextProvider } from '../auth/host-context-provider';
import { DevData } from '../dev/dev-data';
import { TokenProvider } from '../user/token-provider';
import { BitbucketApiFactory, BasicAuthBitbucketApiFactory } from './bitbucket-api-factory';
import { BitbucketLanguagesProvider } from './bitbucket-language-provider';
import { BitbucketTokenHelper } from './bitbucket-token-handler';
const expect = chai.expect;
import { skipIfEnvVarNotSet } from '@gitpod/gitpod-protocol/lib/util/skip-if';

@suite(timeout(10000), retries(2), skipIfEnvVarNotSet('GITPOD_TEST_TOKEN_BITBUCKET'))
class TestBitbucketLanguageProvider {
  protected languageProvider: BitbucketLanguagesProvider;
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
        bind(BitbucketLanguagesProvider).toSelf().inSingletonScope();
        bind(AuthProviderParams).toConstantValue(TestBitbucketLanguageProvider.AUTH_HOST_CONFIG);
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
    this.languageProvider = container.get(BitbucketLanguagesProvider);
    this.user = DevData.createTestUser();
  }

  @test public async testGetLanguages() {
    const result = await this.languageProvider.getLanguages(
      { owner: 'gitpod', name: 'integration-tests' } as Repository,
      this.user,
    );
    expect(result).to.deep.equal({ markdown: 100.0 });
  }

  @test public async testGetLanguagesNonExistingRepo() {
    const result = await this.languageProvider.getLanguages(
      { owner: 'gitpod', name: 'does-not-exist' } as Repository,
      this.user,
    );
    expect(result).to.deep.equal({});
  }
}

module.exports = new TestBitbucketLanguageProvider();
