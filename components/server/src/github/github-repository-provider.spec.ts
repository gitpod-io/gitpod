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

import { GitHubGraphQlEndpoint, GitHubRestApi } from './api';
import { User } from "@gitpod/gitpod-protocol";
import { ContainerModule, Container } from "inversify";
import { Config } from "../config";
import { DevData } from "../dev/dev-data";
import { AuthProviderParams } from "../auth/auth-provider";
import { TokenProvider } from "../user/token-provider";
import { GitHubTokenHelper } from "./github-token-helper";
import { HostContextProvider } from "../auth/host-context-provider";
import { skipIfEnvVarNotSet } from "@gitpod/gitpod-protocol/lib/util/skip-if";
import { GithubRepositoryProvider } from "./github-repository-provider";

@suite(timeout(10000), retries(2), skipIfEnvVarNotSet("GITPOD_TEST_TOKEN_GITHUB"))
class TestGithubContextRepositoryProvider {

    protected provider: GithubRepositoryProvider;
    protected user: User;

    public before() {
        const container = new Container();
        container.load(new ContainerModule((bind, unbind, isBound, rebind) => {
            bind(Config).toConstantValue({
                // meant to appease DI, but Config is never actually used here
            });
            bind(GithubRepositoryProvider).toSelf().inSingletonScope();
            bind(GitHubRestApi).toSelf().inSingletonScope();
            bind(GitHubGraphQlEndpoint).toSelf().inSingletonScope();
            bind(AuthProviderParams).toConstantValue(TestGithubContextRepositoryProvider.AUTH_HOST_CONFIG);
            bind(GitHubTokenHelper).toSelf().inSingletonScope();
            bind(TokenProvider).toConstantValue(<TokenProvider>{
                getTokenForHost: async (user: User, host: string) => {
                    return DevData.createGitHubTestToken();
                }
            });
            bind(HostContextProvider).toConstantValue(DevData.createDummyHostContextProvider());
        }));
        this.provider = container.get(GithubRepositoryProvider);
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

    @test public async testFetchCommitHistory() {
        const result = await this.provider.getCommitHistory(this.user, 'gitpod-io', 'gitpod-test-repo', '409ac2de49a53d679989d438735f78204f441634', 100);
        expect(result).to.deep.equal([
            '506e5aed317f28023994ecf8ca6ed91430e9c1a4',
            'f5b041513bfab914b5fbf7ae55788d9835004d76',
        ])
    }

}
module.exports = new TestGithubContextRepositoryProvider()   // Only to circumvent no usage warning :-/