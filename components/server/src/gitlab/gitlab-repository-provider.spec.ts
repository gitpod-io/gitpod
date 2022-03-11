/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { User } from "@gitpod/gitpod-protocol";
import { skipIfEnvVarNotSet } from "@gitpod/gitpod-protocol/lib/util/skip-if";
import { expect } from "chai";
import { Container, ContainerModule } from "inversify";
import { suite, retries, test, timeout } from "mocha-typescript";
import { AuthProviderParams } from "../auth/auth-provider";
import { HostContextProvider } from "../auth/host-context-provider";
import { DevData } from "../dev/dev-data";
import { TokenProvider } from "../user/token-provider";
import { GitLabApi } from "./api";
import { GitlabContextParser } from "./gitlab-context-parser";
import { GitlabRepositoryProvider } from "./gitlab-repository-provider";
import { GitLabTokenHelper } from "./gitlab-token-helper";

@suite(timeout(10000), retries(2), skipIfEnvVarNotSet("GITPOD_TEST_TOKEN_GITLAB"))
class TestGitlabRepositoryProvider {

    static readonly AUTH_HOST_CONFIG: Partial<AuthProviderParams> = {
        id: "Public-GitLab",
        type: "GitLab",
        verified: true,
        description: "",
        icon: "",
        host: "gitlab.com",
    }

    protected repositoryProvider: GitlabRepositoryProvider;
    protected user: User;

    public before() {
        const container = new Container();
        container.load(new ContainerModule((bind, unbind, isBound, rebind) => {
            bind(GitlabContextParser).toSelf().inSingletonScope();
            bind(GitLabApi).toSelf().inSingletonScope();
            bind(AuthProviderParams).toConstantValue(TestGitlabRepositoryProvider.AUTH_HOST_CONFIG);
            bind(GitLabTokenHelper).toSelf().inSingletonScope();
            bind(TokenProvider).toConstantValue(<TokenProvider>{
                getTokenForHost: async () => DevData.createGitlabTestToken(),
                getFreshPortAuthenticationToken: async (user: User, workspaceId: string) => DevData.createPortAuthTestToken(workspaceId),
            });
            bind(HostContextProvider).toConstantValue(DevData.createDummyHostContextProvider());
            bind(GitlabRepositoryProvider).toSelf().inSingletonScope();
        }));
        this.repositoryProvider = container.get(GitlabRepositoryProvider);
        this.user = DevData.createTestUser();
    }

    @test public async testFetchCommitHistory() {
        const result = await this.repositoryProvider.getCommitHistory(this.user, 'AlexTugarev', 'gp-test', '80948e8cc8f0e851e89a10bc7c2ee234d1a5fbe7', 100);
        expect(result).to.deep.equal([
            '4447fbc4d46e6fd1ee41fb1b992702521ae078eb',
            'f2d9790f2752a794517b949c65a773eb864844cd',
        ])
    }

}

module.exports = new TestGitlabRepositoryProvider();