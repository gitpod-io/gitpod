/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import * as chai from "chai";
import { suite, test } from "@testdeck/mocha";
import { RepoURL } from "./repo-url";

const expect = chai.expect;

@suite
export class RepoUrlTest {
    @test public parseRepoUrl() {
        const testUrl = RepoURL.parseRepoUrl("https://gitlab.com/hello-group/my-cool-project.git");
        expect(testUrl).to.deep.include({
            host: "gitlab.com",
            owner: "hello-group",
            repo: "my-cool-project",
        });
    }

    @test public parseSubgroupOneLevel() {
        const testUrl = RepoURL.parseRepoUrl("https://gitlab.com/hello-group/my-subgroup/my-cool-project.git");
        expect(testUrl).to.deep.include({
            host: "gitlab.com",
            owner: "hello-group/my-subgroup",
            repo: "my-cool-project",
        });
    }

    @test public parseSubgroupTwoLevels() {
        const testUrl = RepoURL.parseRepoUrl(
            "https://gitlab.com/hello-group/my-subgroup/my-sub-subgroup/my-cool-project.git",
        );
        expect(testUrl).to.deep.include({
            host: "gitlab.com",
            owner: "hello-group/my-subgroup/my-sub-subgroup",
            repo: "my-cool-project",
        });
    }

    @test public parseSubgroupThreeLevels() {
        const testUrl = RepoURL.parseRepoUrl(
            "https://gitlab.com/hello-group/my-subgroup/my-sub-subgroup/my-sub-sub-subgroup/my-cool-project.git",
        );
        expect(testUrl).to.deep.include({
            host: "gitlab.com",
            owner: "hello-group/my-subgroup/my-sub-subgroup/my-sub-sub-subgroup",
            repo: "my-cool-project",
        });
    }

    @test public parseSubgroupFourLevels() {
        const testUrl = RepoURL.parseRepoUrl(
            "https://gitlab.com/hello-group/my-subgroup/my-sub-subgroup/my-sub-sub-subgroup/my-sub-sub-sub-subgroup/my-cool-project.git",
        );
        expect(testUrl).to.deep.include({
            host: "gitlab.com",
            owner: "hello-group/my-subgroup/my-sub-subgroup/my-sub-sub-subgroup/my-sub-sub-sub-subgroup",
            repo: "my-cool-project",
        });
    }

    @test public parseScmCloneUrl() {
        const testUrl = RepoURL.parseRepoUrl("https://bitbucket.gitpod-self-hosted.com/scm/~jan/yolo.git");
        expect(testUrl).to.deep.include({
            host: "bitbucket.gitpod-self-hosted.com",
            repoKind: "users",
            owner: "jan",
            repo: "yolo",
        });
    }

    @test public parseScmCloneUrl_with_port() {
        const testUrl = RepoURL.parseRepoUrl("https://foo.bar.com:12345/scm/proj/repoName.git");
        expect(testUrl).to.deep.include({
            host: "foo.bar.com:12345",
            repoKind: "projects",
            owner: "proj",
            repo: "repoName",
        });
    }

    @test public parseAzureScmUrl() {
        const testUrl = RepoURL.parseRepoUrl(
            "https://services-azure@dev.azure.com/services-azure/open-to-edit-project/_git/repo2.kai.klasen.git",
        );
        expect(testUrl).to.deep.include({
            host: "dev.azure.com",
            owner: "services-azure/open-to-edit-project",
            repo: "repo2.kai.klasen",
        });
    }
}

module.exports = new RepoUrlTest();
