/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { suite, test, timeout, skip } from "@testdeck/mocha";
import * as chai from "chai";
const expect = chai.expect;

import { AzureDevOpsContextParser } from "./azure-context-parser";
import { User } from "@gitpod/gitpod-protocol";
import { DevData, DevTestHelper } from "../dev/dev-data";
import { ifEnvVarNotSet } from "@gitpod/gitpod-protocol/lib/util/skip-if";

DevTestHelper.echoAzureTestTips();

@suite(timeout(10000), skip(ifEnvVarNotSet(DevTestHelper.AzureTestEnv)))
class TestAzureDevOpsContextParser {
    protected parser: AzureDevOpsContextParser;
    protected user: User;

    public before() {
        const container = DevTestHelper.createAzureSCMContainer();
        this.parser = container.get(AzureDevOpsContextParser);
        this.user = DevData.createTestUser();
    }

    @test public async testEmptyProject() {
        const result = await this.parser.handle(
            {},
            this.user,
            "https://dev.azure.com/services-azure/_git/empty-project",
        );
        expect(result).to.deep.include({
            path: "",
            isFile: false,
            title: "empty-project/empty-project",
            repository: {
                host: "dev.azure.com",
                owner: "services-azure/empty-project",
                name: "empty-project",
                cloneUrl: "https://dev.azure.com/services-azure/empty-project/_git/empty-project",
                description: "main",
                webUrl: "https://dev.azure.com/services-azure/empty-project/_git/empty-project",
                defaultBranch: "main",
            },
            revision: "",
        });
    }

    @test public async testEmptyProjectWithoutGitSegment() {
        const result = await this.parser.handle({}, this.user, "https://dev.azure.com/services-azure/empty-project");
        expect(result).to.deep.include({
            path: "",
            isFile: false,
            title: "empty-project/empty-project",
            repository: {
                host: "dev.azure.com",
                owner: "services-azure/empty-project",
                name: "empty-project",
                cloneUrl: "https://dev.azure.com/services-azure/empty-project/_git/empty-project",
                description: "main",
                webUrl: "https://dev.azure.com/services-azure/empty-project/_git/empty-project",
                defaultBranch: "main",
            },
            revision: "",
        });
    }

    @test public async testDefault() {
        const result = await this.parser.handle(
            {},
            this.user,
            "https://dev.azure.com/services-azure/test-project/_git/repo2",
        );
        expect(result).to.deep.include({
            path: "",
            isFile: false,
            title: "test-project/repo2 - main",
            repository: {
                host: "dev.azure.com",
                owner: "services-azure/test-project",
                name: "repo2",
                cloneUrl: "https://dev.azure.com/services-azure/test-project/_git/repo2",
                description: "main",
                webUrl: "https://dev.azure.com/services-azure/test-project/_git/repo2",
                defaultBranch: "main",
            },
            revision: "288dba56ce090ada9ee9338d016eb09a853fb49c",
            ref: "main",
            refType: "branch",
        });
    }

    @test public async testPR() {
        const result = await this.parser.handle(
            {},
            this.user,
            "https://dev.azure.com/services-azure/test-project/_git/repo2/pullrequest/1",
        );
        expect(result).to.deep.include({
            nr: 1,
            base: {
                repository: {
                    host: "dev.azure.com",
                    owner: "services-azure/test-project",
                    name: "repo2",
                    cloneUrl: "https://dev.azure.com/services-azure/test-project/_git/repo2",
                    description: "main",
                    webUrl: "https://dev.azure.com/services-azure/test-project/_git/repo2",
                    defaultBranch: "main",
                },
                ref: "main",
                refType: "branch",
            },
            title: "Test Pull Request",
            repository: {
                host: "dev.azure.com",
                owner: "services-azure/test-project",
                name: "repo2",
                cloneUrl: "https://dev.azure.com/services-azure/test-project/_git/repo2",
                description: "main",
                webUrl: "https://dev.azure.com/services-azure/test-project/_git/repo2",
                defaultBranch: "main",
            },
            ref: "develop-2",
            refType: "branch",
            revision: "5e6eb73e1f15e40b1d5fce35a16c1f4dee27b56a",
        });
    }

    @test public async testBranch() {
        const result1 = await this.parser.handle(
            {},
            this.user,
            "https://dev.azure.com/services-azure/test-project/_git/repo2?path=%2F&version=GBdevelop-2&_a=contents",
        );
        expect(result1).to.deep.include({
            path: "",
            isFile: false,
            title: "test-project/repo2 - develop-2",
            repository: {
                host: "dev.azure.com",
                owner: "services-azure/test-project",
                name: "repo2",
                cloneUrl: "https://dev.azure.com/services-azure/test-project/_git/repo2",
                description: "main",
                webUrl: "https://dev.azure.com/services-azure/test-project/_git/repo2",
                defaultBranch: "main",
            },
            revision: "5e6eb73e1f15e40b1d5fce35a16c1f4dee27b56a",
            ref: "develop-2",
            refType: "branch",
        });

        const result2 = await this.parser.handle(
            {},
            this.user,
            "https://dev.azure.com/services-azure/test-project/_git/repo2?path=/.gitpod.yml&version=GBdevelop-2&_a=contents",
        );
        expect(result2).to.deep.include({
            path: "",
            isFile: false,
            title: "test-project/repo2 - develop-2",
            repository: {
                host: "dev.azure.com",
                owner: "services-azure/test-project",
                name: "repo2",
                cloneUrl: "https://dev.azure.com/services-azure/test-project/_git/repo2",
                description: "main",
                webUrl: "https://dev.azure.com/services-azure/test-project/_git/repo2",
                defaultBranch: "main",
            },
            revision: "5e6eb73e1f15e40b1d5fce35a16c1f4dee27b56a",
            ref: "develop-2",
            refType: "branch",
        });

        const result3 = await this.parser.handle(
            {},
            this.user,
            "https://dev.azure.com/services-azure/test-project/_git/repo2-fork?path=/src/index.js&version=GBdevelop-2",
        );
        expect(result3).to.deep.include({
            path: "",
            isFile: false,
            title: "test-project/repo2-fork - develop-2",
            repository: {
                host: "dev.azure.com",
                owner: "services-azure/test-project",
                name: "repo2-fork",
                cloneUrl: "https://dev.azure.com/services-azure/test-project/_git/repo2-fork",
                description: "main",
                webUrl: "https://dev.azure.com/services-azure/test-project/_git/repo2-fork",
                defaultBranch: "main",
            },
            revision: "5e6eb73e1f15e40b1d5fce35a16c1f4dee27b56a",
            ref: "develop-2",
            refType: "branch",
        });
    }

    @test public async testTag() {
        const result = await this.parser.handle(
            {},
            this.user,
            "https://dev.azure.com/services-azure/test-project/_git/repo2-fork?version=GTv0.0.1",
        );
        expect(result).to.deep.include({
            path: "",
            isFile: false,
            title: "test-project/repo2-fork - v0.0.1",
            repository: {
                host: "dev.azure.com",
                owner: "services-azure/test-project",
                name: "repo2-fork",
                cloneUrl: "https://dev.azure.com/services-azure/test-project/_git/repo2-fork",
                description: "main",
                webUrl: "https://dev.azure.com/services-azure/test-project/_git/repo2-fork",
                defaultBranch: "main",
            },
            revision: "a4b191cb2e90201b65acc13e3cbb841ce1c1b5ef",
            ref: "v0.0.1",
            refType: "tag",
        });

        const result2 = await this.parser.handle(
            {},
            this.user,
            "https://dev.azure.com/services-azure/test-project/_git/repo2-fork?version=GTv0.0.1&path=/.gitpod.yml",
        );
        expect(result2).to.deep.include({
            path: "",
            isFile: false,
            title: "test-project/repo2-fork - v0.0.1",
            repository: {
                host: "dev.azure.com",
                owner: "services-azure/test-project",
                name: "repo2-fork",
                cloneUrl: "https://dev.azure.com/services-azure/test-project/_git/repo2-fork",
                description: "main",
                webUrl: "https://dev.azure.com/services-azure/test-project/_git/repo2-fork",
                defaultBranch: "main",
            },
            revision: "a4b191cb2e90201b65acc13e3cbb841ce1c1b5ef",
            ref: "v0.0.1",
            refType: "tag",
        });
    }

    @test public async testCommit() {
        const result = await this.parser.handle(
            {},
            this.user,
            "https://dev.azure.com/services-azure/test-project/_git/repo2-fork/commit/4c47246a2eacd9700aab401902775c248e85aee7",
        );
        expect(result).to.deep.include({
            path: "",
            ref: "",
            refType: "revision",
            revision: "4c47246a2eacd9700aab401902775c248e85aee7",
            isFile: false,
            title: "test-project/repo2-fork - Updated .gitpod.yml",
            owner: "services-azure/test-project",
            repository: {
                host: "dev.azure.com",
                owner: "services-azure/test-project",
                name: "repo2-fork",
                cloneUrl: "https://dev.azure.com/services-azure/test-project/_git/repo2-fork",
                description: "main",
                webUrl: "https://dev.azure.com/services-azure/test-project/_git/repo2-fork",
                defaultBranch: "main",
            },
        });

        const result2 = await this.parser.handle(
            {},
            this.user,
            "https://dev.azure.com/services-azure/test-project/_git/repo2-fork/commit/4c47246a2eacd9700aab401902775c248e85aee7?refName=refs%2Fheads%2Fdevelop",
        );
        expect(result2).to.deep.include({
            path: "",
            ref: "",
            refType: "revision",
            revision: "4c47246a2eacd9700aab401902775c248e85aee7",
            isFile: false,
            title: "test-project/repo2-fork - Updated .gitpod.yml",
            owner: "services-azure/test-project",
            repository: {
                host: "dev.azure.com",
                owner: "services-azure/test-project",
                name: "repo2-fork",
                cloneUrl: "https://dev.azure.com/services-azure/test-project/_git/repo2-fork",
                description: "main",
                webUrl: "https://dev.azure.com/services-azure/test-project/_git/repo2-fork",
                defaultBranch: "main",
            },
        });

        const result3 = await this.parser.handle(
            {},
            this.user,
            "https://dev.azure.com/services-azure/test-project/_git/repo2-fork/commit/4c47246a2eacd9700aab401902775c248e85aee7?refName=refs/heads/develop&path=/.gitpod.yml",
        );
        expect(result3).to.deep.include({
            path: "",
            ref: "",
            refType: "revision",
            revision: "4c47246a2eacd9700aab401902775c248e85aee7",
            isFile: false,
            title: "test-project/repo2-fork - Updated .gitpod.yml",
            owner: "services-azure/test-project",
            repository: {
                host: "dev.azure.com",
                owner: "services-azure/test-project",
                name: "repo2-fork",
                cloneUrl: "https://dev.azure.com/services-azure/test-project/_git/repo2-fork",
                description: "main",
                webUrl: "https://dev.azure.com/services-azure/test-project/_git/repo2-fork",
                defaultBranch: "main",
            },
        });
    }
}

module.exports = new TestAzureDevOpsContextParser();
