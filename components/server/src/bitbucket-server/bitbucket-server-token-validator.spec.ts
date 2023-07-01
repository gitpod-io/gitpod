/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { ifEnvVarNotSet } from "@gitpod/gitpod-protocol/lib/util/skip-if";
import { Container, ContainerModule } from "inversify";
import { retries, skip, suite, test, timeout } from "@testdeck/mocha";
import { expect } from "chai";
import { BitbucketServerApi } from "./bitbucket-server-api";
import { BitbucketServerTokenValidator } from "./bitbucket-server-token-validator";
import { AuthProviderParams } from "../auth/auth-provider";
import { BitbucketServerTokenHelper } from "./bitbucket-server-token-handler";
import { TokenProvider } from "../user/token-provider";

@suite(timeout(10000), retries(0), skip(ifEnvVarNotSet("GITPOD_TEST_TOKEN_BITBUCKET_SERVER")))
class TestBitbucketServerTokenValidator {
    protected validator: BitbucketServerTokenValidator;

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
                bind(BitbucketServerTokenValidator).toSelf().inSingletonScope();
                bind(AuthProviderParams).toConstantValue(TestBitbucketServerTokenValidator.AUTH_HOST_CONFIG);
                bind(BitbucketServerTokenHelper).toSelf().inSingletonScope();
                bind(TokenProvider).toConstantValue(<TokenProvider>{
                    getTokenForHost: async () => {
                        return {
                            value: process.env["GITPOD_TEST_TOKEN_BITBUCKET_SERVER"] || "undefined",
                            scopes: [],
                        };
                    },
                });
                bind(BitbucketServerApi).toSelf().inSingletonScope();
            }),
        );
        this.validator = container.get(BitbucketServerTokenValidator);
    }

    @test async test_checkWriteAccess_read_only() {
        const result = await this.validator.checkWriteAccess({
            host: "bitbucket.gitpod-self-hosted.com",
            owner: "mil",
            repo: "gitpod-large-image",
            repoKind: "projects",
            token: process.env["GITPOD_TEST_TOKEN_BITBUCKET_SERVER"]!,
        });
        expect(result).to.deep.equal({
            found: true,
            isPrivateRepo: true,
            writeAccessToRepo: false,
        });
    }

    @test async test_checkWriteAccess_write_permissions() {
        const result = await this.validator.checkWriteAccess({
            host: "bitbucket.gitpod-self-hosted.com",
            owner: "alextugarev",
            repo: "yolo",
            repoKind: "users",
            token: process.env["GITPOD_TEST_TOKEN_BITBUCKET_SERVER"]!,
        });
        expect(result).to.deep.equal({
            found: true,
            isPrivateRepo: false,
            writeAccessToRepo: true,
        });
    }
}

module.exports = new TestBitbucketServerTokenValidator();
