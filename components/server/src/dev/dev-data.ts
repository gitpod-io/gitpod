/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { IssueContext, User, PullRequestContext, Repository, Token } from "@gitpod/gitpod-protocol";
import {
    GitHubOAuthScopes,
    GitLabOAuthScopes,
    AzureDevOpsOAuthScopes,
} from "@gitpod/public-api-common/lib/auth-providers";
import { AzureDevOpsContextParser } from "../azure-devops/azure-context-parser";
import { AzureDevOpsApi } from "../azure-devops/azure-api";
import { AuthProviderParams } from "../auth/auth-provider";
import { AzureDevOpsTokenHelper } from "../azure-devops/azure-token-helper";
import { TokenProvider } from "../user/token-provider";
import { HostContextProvider } from "../auth/host-context-provider";
import { Container, ContainerModule } from "inversify";
import { AzureDevOpsFileProvider } from "../azure-devops/azure-file-provider";
import { AzureDevOpsRepositoryProvider } from "../azure-devops/azure-repository-provider";
import { Config } from "../config";

export namespace DevData {
    export function createTestUser(): User {
        return {
            id: "somefox",
            name: "somefox",
            avatarUrl: "https://github.com/typefox.png",
            creationDate: new Date().toISOString(),
            identities: [
                {
                    authId: "33891423",
                    authName: "somefox",
                    authProviderId: "Public-GitHub",
                    primaryEmail: "somefox@gitpod.io",
                },
                {
                    authId: "3171928",
                    authName: "somefox",
                    authProviderId: "Public-GitLab",
                    primaryEmail: "somefox@gitpod.io",
                },
            ],
            additionalData: {
                emailNotificationSettings: {
                    allowsChangelogMail: true,
                    allowsDevXMail: true,
                },
            },
        };
    }

    export function createGitHubTestToken(): Token {
        if (!process.env.GITPOD_TEST_TOKEN_GITHUB) {
            console.error(
                `GITPOD_TEST_TOKEN_GITHUB env var is not set\n\n\t export GITPOD_TEST_TOKEN_GITHUB='{"username": "gitpod-test", "value": $GITHUB_TOKEN}'`,
            );
        }
        return {
            ...getTokenFromEnv("GITPOD_TEST_TOKEN_GITHUB"),
            scopes: [GitHubOAuthScopes.EMAIL, GitHubOAuthScopes.PUBLIC, GitHubOAuthScopes.PRIVATE],
        };
    }

    export function createDummyHostContextProvider(): any {
        return {
            get: (hostname: string) => {
                const authProviderId = hostname === "github.com" ? "Public-GitHub" : "Public-GitLab";
                return {
                    authProvider: {
                        authProviderId,
                    },
                };
            },
        };
    }

    export function createGitlabTestToken(): Token {
        return {
            ...getTokenFromEnv("GITPOD_TEST_TOKEN_GITLAB"),
            scopes: [GitLabOAuthScopes.READ_USER, GitLabOAuthScopes.API],
        };
    }

    export function createAzureDevOpsTestToken(): Token {
        return {
            ...getTokenFromEnv("GITPOD_TEST_TOKEN_AZURE_DEVOPS"),
            scopes: [...AzureDevOpsOAuthScopes.DEFAULT],
        };
    }

    export function createBitbucketTestToken(): Token {
        const result = {
            ...getTokenFromEnv("GITPOD_TEST_TOKEN_BITBUCKET"),
            scopes: [],
        };
        return result;
    }

    function getTokenFromEnv(varname: string): Token {
        const secret = process.env[varname];
        if (!secret) {
            throw new Error(`${varname} env var is not set`);
        }
        return JSON.parse(secret);
    }

    export function createPrContext(user: User): PullRequestContext {
        const repository: Repository = {
            host: "github.com",
            owner: user.identities[0].authName,
            name: "gitpod-test-repo",
            cloneUrl: "https://github.com/gitpod-io/gitpod-test-repo.git",
        };
        return <PullRequestContext>{
            repository,
            title: "Test PR",
            nr: 13,
            ref: "12test",
            revision: "",
            base: {
                repository,
                ref: "1test",
            },
        };
    }

    export function createIssueContext(user: User): IssueContext {
        const repository: Repository = {
            host: "github.com",
            owner: user.identities[0].authName,
            name: "gitpod-test-repo",
            cloneUrl: "https://github.com/gitpod-io/gitpod-test-repo.git",
        };
        return <IssueContext>{
            ref: "GH-15",
            repository,
            title: "My First Issue",
            nr: 15,
            revision: "",
        };
    }
}

export namespace DevTestHelper {
    export const AzureTestEnv = "GITPOD_TEST_TOKEN_AZURE_DEVOPS";
    export function echoAzureTestTips() {
        if (!process.env[AzureTestEnv]) {
            console.warn(
                `No Azure DevOps test token set. Skipping Azure DevOps tests.\n\t export AZURE_TOKEN=<your-token>\nexport ${AzureTestEnv}='{"value": "'$AZURE_TOKEN'"}'`,
            );
        }
    }
    export function createAzureSCMContainer() {
        const container = new Container();
        const AUTH_HOST_CONFIG: Partial<AuthProviderParams> = {
            id: "0000-Azure-DevOps",
            type: "AzureDevOps",
            verified: true,
            description: "",
            icon: "",
            host: "dev.azure.com",
        };
        container.load(
            new ContainerModule((bind, unbind, isBound, rebind) => {
                bind(Config).toConstantValue({});
                bind(AzureDevOpsContextParser).toSelf().inSingletonScope();
                bind(AzureDevOpsApi).toSelf().inSingletonScope();
                bind(AuthProviderParams).toConstantValue(AUTH_HOST_CONFIG);
                bind(AzureDevOpsTokenHelper).toSelf().inSingletonScope();
                bind(TokenProvider).toConstantValue(<TokenProvider>{
                    getTokenForHost: async () => DevData.createAzureDevOpsTestToken(),
                });
                bind(HostContextProvider).toConstantValue(DevData.createDummyHostContextProvider());
                bind(AzureDevOpsFileProvider).toSelf().inSingletonScope();
                bind(AzureDevOpsRepositoryProvider).toSelf().inSingletonScope();
            }),
        );
        return container;
    }
}
