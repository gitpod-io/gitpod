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
import { AzureDevOpsFileProvider } from "./azure-file-provider";

DevTestHelper.echoAzureTestTips();

@suite(timeout(10000), skip(ifEnvVarNotSet(DevTestHelper.AzureTestEnv)))
class TestAzureDevOpsFileProvider {
    protected fileProvider: AzureDevOpsFileProvider;
    protected user: User;
    protected container: Container;

    public before() {
        this.container = DevTestHelper.createAzureSCMContainer();
        this.fileProvider = this.container.get(AzureDevOpsFileProvider);
        this.user = DevData.createTestUser();
    }

    @test public async testFileContent() {
        const result = await this.fileProvider.getFileContent(
            {
                repository: {
                    host: "dev.azure.com",
                    owner: "services-azure/test-project",
                    name: "repo2",
                    cloneUrl: "https://services-azure@dev.azure.com/services-azure/test-project/_git/repo2",
                    description: "main",
                    webUrl: "https://dev.azure.com/services-azure/test-project/_git/repo2",
                    defaultBranch: "main",
                },
                revision: "288dba56ce090ada9ee9338d016eb09a853fb49c",
                ref: "main",
                refType: "branch",
            },
            this.user,
            ".gitpod.yml",
        );
        expect(result).to.equal(`tasks:
  - name: task 1
    command: echo hello
  - name: task 2
    init: echo 'task 1 - init'
    command: echo 'task 2 - command'`);
    }

    @test public async testFileContentNotFound() {
        const result = await this.fileProvider.getFileContent(
            {
                repository: {
                    host: "dev.azure.com",
                    owner: "services-azure/test-project",
                    name: "repo2",
                    cloneUrl: "https://services-azure@dev.azure.com/services-azure/test-project/_git/repo2",
                    description: "main",
                    webUrl: "https://dev.azure.com/services-azure/test-project/_git/repo2",
                    defaultBranch: "main",
                },
                revision: "288dba56ce090ada9ee9338d016eb09a853fb49c",
                ref: "main",
                refType: "branch",
            },
            this.user,
            "not_found.txt",
        );
        expect(result).to.equal(undefined);
    }
}

module.exports = new TestAzureDevOpsFileProvider();
