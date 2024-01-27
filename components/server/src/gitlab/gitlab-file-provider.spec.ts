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
import { TokenProvider } from "../user/token-provider";
import { GitLab, GitLabApi } from "./api";
import { GitlabFileProvider } from "./file-provider";
import { GitLabTokenHelper } from "./gitlab-token-helper";

@suite(timeout(10000), retries(2), skip(ifEnvVarNotSet("GITPOD_TEST_TOKEN_GITLAB")))
class TestFileProvider {
    static readonly AUTH_HOST_CONFIG: Partial<AuthProviderParams> = {
        id: "Public-GitLab",
        type: "GitLab",
        verified: true,
        description: "",
        icon: "",
        host: "gitlab.com",
    };

    protected fileProvider: GitlabFileProvider;
    protected user: User;
    protected container: Container;

    public before() {
        this.container = new Container();
        this.container.load(
            new ContainerModule((bind, unbind, isBound, rebind) => {
                bind(GitLabApi).toSelf().inSingletonScope();
                bind(AuthProviderParams).toConstantValue(TestFileProvider.AUTH_HOST_CONFIG);
                bind(GitLabTokenHelper).toSelf().inSingletonScope();
                bind(TokenProvider).toConstantValue(<TokenProvider>{
                    getTokenForHost: async () => DevData.createGitlabTestToken(),
                });
                bind(GitlabFileProvider).toSelf().inSingletonScope();
            }),
        );
        this.fileProvider = this.container.get(GitlabFileProvider);
        this.user = DevData.createTestUser();
    }

    @test public async testFileContent() {
        const result = await this.fileProvider.getFileContent(
            {
                repository: {
                    owner: "AlexTugarev",
                    name: "gp-test",
                    host: "gitlab.com",
                    cloneUrl: "unused in test",
                },
                revision: "af65de8b249855785bbc7a8073ebcf21f55bc8fb",
            },
            this.user,
            "README.md",
        );
        expect(result).to.equal(`# gp-test

123`);
    }

    // manual test helper to create many repos
    @test.skip public async createManyRepos() {
        const api = this.container.get(GitLabApi);
        for (let i = 151; i < 200; i++) {
            try {
                const project = await api.run<GitLab.Project>(this.user, (g) =>
                    g.Projects.create({
                        name: `test_project_${i}`,
                        namespaceId: 57982169,
                        initializeWithReadme: true,
                        description: "generated project to test pagination",
                    }),
                );
                if (GitLab.ApiError.is(project)) {
                    console.error(`attempt ${i} error: ${JSON.stringify(project.message)}`);
                } else {
                    console.log(project.name_with_namespace + " created ✅");
                }
                await new Promise((resolve) => setTimeout(resolve, 500));
            } catch (error) {
                console.error(error);
            }
        }
    }
}

module.exports = new TestFileProvider();
