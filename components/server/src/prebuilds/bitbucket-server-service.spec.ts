/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { User } from "@gitpod/gitpod-protocol";
import { ifEnvVarNotSet } from "@gitpod/gitpod-protocol/lib/util/skip-if";
import { Container, ContainerModule } from "inversify";
import { retries, skip, suite, test, timeout } from "@testdeck/mocha";
import { AuthProviderParams } from "../auth/auth-provider";
import { HostContextProvider } from "../auth/host-context-provider";
import { BitbucketServerApi } from "../bitbucket-server/bitbucket-server-api";
import { BitbucketServerContextParser } from "../bitbucket-server/bitbucket-server-context-parser";
import { BitbucketServerTokenHelper } from "../bitbucket-server/bitbucket-server-token-handler";
import { TokenProvider } from "../user/token-provider";
import { BitbucketServerService } from "./bitbucket-server-service";
import { expect } from "chai";
import { Config } from "../config";
import { TokenService } from "../user/token-service";
import { GitpodHostUrl } from "@gitpod/gitpod-protocol/lib/util/gitpod-host-url";

@suite(timeout(10000), retries(1), skip(ifEnvVarNotSet("GITPOD_TEST_TOKEN_BITBUCKET_SERVER")))
class TestBitbucketServerService {
    protected service: BitbucketServerService;
    protected user: User;

    static readonly AUTH_HOST_CONFIG: Partial<AuthProviderParams> = {
        id: "MyBitbucketServer",
        type: "BitbucketServer",
        verified: true,
        description: "",
        icon: "",
        host: "bitbucket.gitpod-self-hosted.com",
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
            new ContainerModule((bind, unbind, isBound, rebind) => {
                bind(BitbucketServerService).toSelf().inSingletonScope();
                bind(BitbucketServerContextParser).toSelf().inSingletonScope();
                bind(AuthProviderParams).toConstantValue(TestBitbucketServerService.AUTH_HOST_CONFIG);
                bind(BitbucketServerTokenHelper).toSelf().inSingletonScope();
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
        this.service = container.get(BitbucketServerService);
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
            emails: [],
        };
    }

    @test async test_canInstallAutomatedPrebuilds_unauthorized() {
        const result = await this.service.canInstallAutomatedPrebuilds(
            this.user,
            "https://bitbucket.gitpod-self-hosted.com/users/jldec/repos/test-repo",
        );
        expect(result).to.be.false;
    }

    @test async test_canInstallAutomatedPrebuilds_in_project_ok() {
        const result = await this.service.canInstallAutomatedPrebuilds(
            this.user,
            "https://bitbucket.gitpod-self-hosted.com/projects/jldec/repos/jldec-repo-march-30",
        );
        expect(result).to.be.true;
    }

    @test async test_canInstallAutomatedPrebuilds_ok() {
        const result = await this.service.canInstallAutomatedPrebuilds(
            this.user,
            "https://bitbucket.gitpod-self-hosted.com/projects/FOO/repos/repo123",
        );
        expect(result).to.be.true;
    }

    @test async test_canInstallAutomatedPrebuilds_users_project_ok() {
        const result = await this.service.canInstallAutomatedPrebuilds(
            this.user,
            "https://bitbucket.gitpod-self-hosted.com/scm/~alextugarev/yolo.git",
        );
        expect(result).to.be.true;
    }

    @test async test_installAutomatedPrebuilds_ok() {
        try {
            await this.service.installAutomatedPrebuilds(
                this.user,
                "https://bitbucket.gitpod-self-hosted.com/projects/FOO/repos/repo123",
            );
        } catch (error) {
            expect.fail(error);
        }
    }

    @test async test_installAutomatedPrebuilds_unauthorized() {
        try {
            await this.service.installAutomatedPrebuilds(
                this.user,
                "https://bitbucket.gitpod-self-hosted.com/users/jldec/repos/test-repo",
            );
            expect.fail("should have failed");
        } catch (error) {}
    }

    @test async test_installAutomatedPrebuilds_in_project_ok() {
        try {
            await this.service.installAutomatedPrebuilds(
                this.user,
                "https://bitbucket.gitpod-self-hosted.com/projects/jldec/repos/jldec-repo-march-30",
            );
        } catch (error) {
            expect.fail(error);
        }
    }
}

module.exports = new TestBitbucketServerService();
