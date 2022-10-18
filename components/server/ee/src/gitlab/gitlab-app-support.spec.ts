/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { User } from "@gitpod/gitpod-protocol";
import { skipIfEnvVarNotSet } from "@gitpod/gitpod-protocol/lib/util/skip-if";
import { expect } from "chai";
import { Container, ContainerModule } from "inversify";
import { suite, retries, test, timeout } from "mocha-typescript";
import { AuthProviderParams } from "../../../src/auth/auth-provider";
import { DevData } from "../../../src/dev/dev-data";
import { GitLabApi } from "../../../src/gitlab/api";
import { GitLabTokenHelper } from "../../../src/gitlab/gitlab-token-helper";
import { TokenProvider } from "../../../src/user/token-provider";
import { GitLabAppSupport } from "./gitlab-app-support";

@suite(timeout(10000), retries(2), skipIfEnvVarNotSet("GITPOD_TEST_TOKEN_GITLAB"))
class TestGitLabAppSupport {
    static readonly AUTH_HOST_CONFIG: Partial<AuthProviderParams> = {
        id: "Public-GitLab",
        type: "GitLab",
        verified: true,
        description: "",
        icon: "",
        host: "gitlab.com",
    };

    protected appSupport: GitLabAppSupport;
    protected user: User;
    protected container: Container;

    public before() {
        this.container = new Container();
        this.container.load(
            new ContainerModule((bind, unbind, isBound, rebind) => {
                bind(GitLabApi).toSelf().inSingletonScope();
                bind(AuthProviderParams).toConstantValue(TestGitLabAppSupport.AUTH_HOST_CONFIG);
                bind(GitLabTokenHelper).toSelf().inSingletonScope();
                bind(TokenProvider).toConstantValue(<TokenProvider>{
                    getTokenForHost: async () => DevData.createGitlabTestToken(),
                    getFreshPortAuthenticationToken: async (user: User, workspaceId: string) =>
                        DevData.createPortAuthTestToken(workspaceId),
                });
                bind(GitLabAppSupport).toSelf().inSingletonScope();
            }),
        );
        this.appSupport = this.container.get(GitLabAppSupport);
        this.user = DevData.createTestUser();
    }

    // this manual test is assume you've maintainer access to +200 project
    // see createManyRepos in /workspace/gitpod/components/server/src/gitlab/gitlab-file-provider.spec.ts
    // for how to set up a test group with that many projects ;-)
    @test.skip public async testFindMoreThan200Projects() {
        const result = await this.appSupport.getProviderRepositoriesForUser({
            user: this.user,
            provider: {
                host: "gitlab.com",
                authProviderId: "Public-GitLab",
                authProviderType: "GitLab",
                verified: true,
            },
        });
        expect(result.length).to.be.greaterThan(200);
    }
}

module.exports = new TestGitLabAppSupport();
