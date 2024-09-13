/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { User } from "@gitpod/gitpod-protocol";
import { ifEnvVarNotSet } from "@gitpod/gitpod-protocol/lib/util/skip-if";
import { expect } from "chai";
import { Container } from "inversify";
import { suite, test, timeout, skip } from "@testdeck/mocha";
import { DevData, DevTestHelper } from "../dev/dev-data";
import { AzureDevOpsApi } from "./azure-api";

DevTestHelper.echoAzureTestTips();

@suite(timeout(10000), skip(ifEnvVarNotSet(DevTestHelper.AzureTestEnv)))
class TestAzureDevOpsFileProvider {
    protected azureDevOpsApi: AzureDevOpsApi;
    protected user: User;
    protected container: Container;

    public before() {
        this.container = DevTestHelper.createAzureSCMContainer();
        this.azureDevOpsApi = this.container.get(AzureDevOpsApi);
        this.user = DevData.createTestUser();
    }

    @test public async happyPath() {
        const result = await this.azureDevOpsApi.getRepository(this.user, "services-azure", "test-project", "repo2");
        expect(result.name).to.equal("repo2");
    }
}

module.exports = new TestAzureDevOpsFileProvider();
