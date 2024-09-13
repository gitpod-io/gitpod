/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { suite, test, timeout, retries, skip } from "@testdeck/mocha";
import * as chai from "chai";
const expect = chai.expect;

import { AzureDevOpsContextParser } from "./azure-context-parser";
import { User } from "@gitpod/gitpod-protocol";
import { ContainerModule, Container } from "inversify";
import { DevData } from "../dev/dev-data";
import { AzureDevOpsApi } from "./azure-api";
import { AuthProviderParams } from "../auth/auth-provider";
import { AzureDevOpsTokenHelper } from "./azure-token-helper";
import { TokenProvider } from "../user/token-provider";
import { HostContextProvider } from "../auth/host-context-provider";
import { ifEnvVarNotSet } from "@gitpod/gitpod-protocol/lib/util/skip-if";

@suite(timeout(10000), retries(2), skip(ifEnvVarNotSet("GITPOD_TEST_TOKEN_AZURE_DEVOPS")))
class TestAzureDevOpsContextParser {
    protected parser: AzureDevOpsContextParser;
    protected user: User;

    public before() {
        const container = new Container();
        container.load(
            new ContainerModule((bind, unbind, isBound, rebind) => {
                bind(AzureDevOpsContextParser).toSelf().inSingletonScope();
                bind(AzureDevOpsApi).toSelf().inSingletonScope();
                bind(AuthProviderParams).toConstantValue(TestAzureDevOpsContextParser.AUTH_HOST_CONFIG);
                bind(AzureDevOpsTokenHelper).toSelf().inSingletonScope();
                bind(TokenProvider).toConstantValue(<TokenProvider>{
                    getTokenForHost: async () => DevData.createAzureDevOpsTestToken(),
                });
                bind(HostContextProvider).toConstantValue(DevData.createDummyHostContextProvider());
            }),
        );
        this.parser = container.get(AzureDevOpsContextParser);
        this.user = DevData.createTestUser();
    }
    static readonly AUTH_HOST_CONFIG: Partial<AuthProviderParams> = {
        id: "Public-GitHub",
        type: "AzureDevOps",
        verified: true,
        description: "",
        icon: "",
        host: "dev.azure.com",
    };
    static readonly BLO_BLA_ERROR_DATA = {
        host: "dev.azure.com",
        lastUpdate: undefined,
        owner: "blo",
        repoName: "bla",
        userIsOwner: false,
        userScopes: ["read_user", "api"],
    };

    @test public async testEmptyProoject() {
        const result = await this.parser.handle(
            {},
            this.user,
            "https://dev.azure.com/services-azure/_git/empty-project",
        );
        expect(result).to.deep.include({
            isFile: false,
            repository: {
                host: "dev.azure.com",
                owner: "services-azure",
                name: "empty-project/empty-project",
                cloneUrl: "https://gitlab.com/blo/bla.git",
                private: false,
                defaultBranch: "master",
            },
            title: "blo/bla - master",
        });
    }
}

module.exports = new TestAzureDevOpsContextParser();
