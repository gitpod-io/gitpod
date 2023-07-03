/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { User } from "@gitpod/gitpod-protocol";
import { ifEnvVarNotSet } from "@gitpod/gitpod-protocol/lib/util/skip-if";
import { expect } from "chai";
import { Container, ContainerModule } from "inversify";
import { suite, retries, test, timeout, skip } from "@testdeck/mocha";
import { AuthProviderParams } from "../auth/auth-provider";
import { DevData } from "../dev/dev-data";
import { GitLabApi } from "./api";
import { GitLabTokenHelper } from "./gitlab-token-helper";
import { TokenProvider } from "../user/token-provider";
import { GitLabAppSupport } from "./gitlab-app-support";

@suite(timeout(10000), retries(2), skip(ifEnvVarNotSet("GITPOD_TEST_TOKEN_GITLAB")))
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
