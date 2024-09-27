/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { User } from "@gitpod/gitpod-protocol";
import { ifEnvVarNotSet } from "@gitpod/gitpod-protocol/lib/util/skip-if";
import { expect } from "chai";
import { suite, test, timeout, skip } from "@testdeck/mocha";
import { DevData, DevTestHelper } from "../dev/dev-data";
import { AzureDevOpsRepositoryProvider } from "./azure-repository-provider";

DevTestHelper.echoAzureTestTips();

@suite(timeout(10000), skip(ifEnvVarNotSet(DevTestHelper.AzureTestEnv)))
class TestAzureDevOpsRepositoryProvider {
    protected repositoryProvider: AzureDevOpsRepositoryProvider;
    protected user: User;

    public before() {
        const container = DevTestHelper.createAzureSCMContainer();
        this.repositoryProvider = container.get(AzureDevOpsRepositoryProvider);
        this.user = DevData.createTestUser();
    }

    @test public async testFetchCommitHistory() {
        const result = await this.repositoryProvider.getCommitHistory(
            this.user,
            "services-azure/test-project",
            "repo2-fork",
            "dafbf184f68e7ee4dc6d1174d962cab84b605eb2",
            100,
        );
        expect(result).to.deep.equal([
            "a4b191cb2e90201b65acc13e3cbb841ce1c1b5ef",
            "5107e928e0970c5f04b32e110d0cf8e147fcc596",
            "05f492e633098e4348468c97940cc68dcd566403",
            "6e18c86b251982d5a289a362ce9eb5a270932b60",
        ]);
    }
}

module.exports = new TestAzureDevOpsRepositoryProvider();
