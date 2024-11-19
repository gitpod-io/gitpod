/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Repository, User } from "@gitpod/gitpod-protocol";
import { ifEnvVarNotSet } from "@gitpod/gitpod-protocol/lib/util/skip-if";
import { Container, ContainerModule } from "inversify";
import { retries, skip, suite, test, timeout } from "@testdeck/mocha";
import { expect } from "chai";
import { GitpodHostUrl } from "@gitpod/gitpod-protocol/lib/util/gitpod-host-url";
import { BitbucketServerFileProvider } from "./bitbucket-server-file-provider";
import { AuthProviderParams } from "../auth/auth-provider";
import { BitbucketServerContextParser } from "./bitbucket-server-context-parser";
import { BitbucketServerTokenHelper } from "./bitbucket-server-token-handler";
import { TokenService } from "../user/token-service";
import { Config } from "../config";
import { TokenProvider } from "../user/token-provider";
import { BitbucketServerApi } from "./bitbucket-server-api";
import { HostContextProvider } from "../auth/host-context-provider";

@suite(timeout(10000), retries(1), skip(ifEnvVarNotSet("GITPOD_TEST_TOKEN_BITBUCKET_SERVER")))
class TestBitbucketServerFileProvider {
    protected service: BitbucketServerFileProvider;
    protected user: User;

    static readonly AUTH_HOST_CONFIG: Partial<AuthProviderParams> = {
        id: "MyBitbucketServer",
        type: "BitbucketServer",
        verified: true,
        description: "",
        icon: "",
        host: "bitbucket.gitpod-dev.com",
        oauth: {
            callBackUrl: "",
            clientId: "not-used",
            clientSecret: "",
            tokenUrl: "",
            scope: "",
            authorizationUrl: "",
        },
    };

    public before() {
        const container = new Container();
        container.load(
            new ContainerModule((bind) => {
                bind(BitbucketServerFileProvider).toSelf().inSingletonScope();
                bind(BitbucketServerContextParser).toSelf().inSingletonScope();
                bind(AuthProviderParams).toConstantValue(TestBitbucketServerFileProvider.AUTH_HOST_CONFIG);
                bind(BitbucketServerTokenHelper).toSelf().inSingletonScope();
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                bind(TokenService).toConstantValue({
                    createGitpodToken: async () => ({ token: { value: "foobar123-token" } }),
                } as any);
                bind(Config).toConstantValue({
                    hostUrl: new GitpodHostUrl("https://gitpod.io"),
                });
                bind(TokenProvider).toConstantValue(<TokenProvider>{
                    getTokenForHost: async () => {
                        return {
                            value: process.env["GITPOD_TEST_TOKEN_BITBUCKET_SERVER"] || "undefined",
                            scopes: [],
                        };
                    },
                });
                bind(BitbucketServerApi).toSelf().inSingletonScope();
                bind(HostContextProvider).toConstantValue({
                    get: (hostname: string) => {
                        authProvider: {
                            ("BBS");
                        }
                    },
                });
            }),
        );
        this.service = container.get(BitbucketServerFileProvider);
        this.user = {
            creationDate: "",
            id: "user1",
            identities: [
                {
                    authId: "user1",
                    authName: "AlexTugarev",
                    authProviderId: "MyBitbucketServer",
                },
            ],
        };
    }

    @test async test_getGitpodFileContent_ok() {
        const result = await this.service.getGitpodFileContent(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            {
                revision: "main",
                repository: <Repository>{
                    cloneUrl: "https://bitbucket.gitpod-dev.com/users/filip/repos/spring-petclinic",
                    webUrl: "https://bitbucket.gitpod-dev.com/users/filip/repos/spring-petclinic",
                    name: "spring-petclinic",
                    repoKind: "users",
                    owner: "filip",
                },
            } as any,
            this.user,
        );
        expect(result).not.to.be.empty;
        expect(result).to.contain("tasks:");
    }

    @test async test_getLastChangeRevision_ok() {
        const result = await this.service.getLastChangeRevision(
            {
                owner: "filip",
                name: "spring-petclinic",
                repoKind: "users",
                revision: "ft/invalid-docker",
                host: "bitbucket.gitpod-dev.com",
                cloneUrl: "https://bitbucket.gitpod-dev.com/users/filip/repos/spring-petclinic",
                webUrl: "https://bitbucket.gitpod-dev.com/users/filip/repos/spring-petclinic",
            } as Repository,
            "ft/invalid-docker",
            this.user,
            ".gitpod.yml",
        );
        expect(result).to.equal("7e38d77cc599682f543f71da36328307e35caa94");
    }

    @test async test_getLastChangeRevision_not_found() {
        // it looks like expecting a promise to throw doesn't work, so we hack it with a try-catch
        let didThrow = false;
        try {
            await this.service.getLastChangeRevision(
                {
                    owner: "filip",
                    name: "spring-petclinic",
                    repoKind: "users",
                    revision: "ft/invalid-docker",
                    host: "bitbucket.gitpod-dev.com",
                    cloneUrl: "https://bitbucket.gitpod-dev.com/users/filip/repos/spring-petclinic",
                    webUrl: "https://bitbucket.gitpod-dev.com/users/filip/repos/spring-petclinic",
                } as Repository,
                "ft/invalid-docker",
                this.user,
                "gitpod.Dockerfile",
            );
        } catch (err) {
            didThrow = true;
        }
        expect(didThrow).to.be.true;
    }
}

module.exports = new TestBitbucketServerFileProvider();
