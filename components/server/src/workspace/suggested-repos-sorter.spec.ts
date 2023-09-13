/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import "reflect-metadata";

import { suite, test } from "@testdeck/mocha";
import { expect } from "chai";
import { PRIORITY_HIGH, PRIORITY_LOW, PRIORITY_MEDIUM, sortSuggestedRepositories } from "./suggested-repos-sorter";

@suite
class TestSuggestedReposSorter {
    @test
    public testPrioritySorting() {
        const repo1 = {
            priority: PRIORITY_HIGH,
            url: "https://github.com/repo1",
        };
        const repo2 = {
            priority: PRIORITY_MEDIUM,
            url: "https://github.com/repo2",
        };
        const sortedRepos = sortSuggestedRepositories([repo1, repo2]);
        expect(sortedRepos[0].url).equals(repo1.url);
        expect(sortedRepos[1].url).equals(repo2.url);
    }

    @test
    public testNameSorting() {
        const repo1 = {
            priority: PRIORITY_LOW,
            url: "https://github.com/repo1",
        };
        const repo2 = {
            priority: PRIORITY_LOW,
            url: "https://github.com/repo2",
        };
        const sortedRepos = sortSuggestedRepositories([repo1, repo2]);
        expect(sortedRepos[0].url).equals(repo1.url);
        expect(sortedRepos[1].url).equals(repo2.url);
    }

    @test testLastUseSorting() {
        const repo1 = {
            priority: PRIORITY_LOW,
            url: "https://github.com/repo1",
            lastUse: "2023-08-13T01:00:00Z",
        };
        const repo2 = {
            priority: PRIORITY_LOW,
            url: "https://github.com/repo2",
            lastUse: "2023-08-13T02:00:00Z",
        };
        const repos = sortSuggestedRepositories([repo1, repo2]);
        expect(repos[0].url).equals(repo2.url);
        expect(repos[1].url).equals(repo1.url);
    }

    @test
    public testAlphaSortingWithNames() {
        const repo1 = {
            priority: PRIORITY_LOW,
            url: "https://github.com/repo1",
            projectName: "Project A",
            repositoryName: "Repo 1",
        };
        const repo2 = {
            priority: PRIORITY_LOW,
            url: "https://github.com/repo2",
            projectName: "Project B",
            repositoryName: "Repo 2",
        };
        const repo3 = {
            priority: PRIORITY_LOW,
            url: "https://github.com/repo3",
            projectName: "Project C",
        };
        const repo4 = {
            priority: PRIORITY_LOW,
            url: "https://github.com/repo4",
            repositoryName: "A Great Repo",
        };
        const repo5 = {
            priority: PRIORITY_LOW,
            url: "https://github.com/repo5",
        };
        const repos = sortSuggestedRepositories([repo1, repo2, repo3, repo4, repo5]);
        expect(repos[0].url).equals(repo4.url);
        expect(repos[1].url).equals(repo5.url);
        expect(repos[2].url).equals(repo1.url);
        expect(repos[3].url).equals(repo2.url);
        expect(repos[4].url).equals(repo3.url);
    }

    @test
    public testMixedSorting() {
        const repo1 = {
            priority: PRIORITY_HIGH,
            url: "https://github.com/repo1",
            projectName: "Project A",
            lastUse: "2023-08-13T01:00:00Z",
        };
        const repo2 = {
            priority: PRIORITY_MEDIUM,
            url: "https://github.com/repo2",
            repositoryName: "Repo 2",
            lastUse: "2023-08-13T02:00:00Z",
        };
        const repo3 = {
            priority: PRIORITY_LOW,
            url: "https://github.com/repo3",
            repositoryName: "Repo 3",
            lastUse: "2023-08-13T03:00:00Z",
        };
        const repo4 = {
            priority: PRIORITY_LOW,
            url: "https://github.com/repo4",
            repositoryName: "Repo 4",
            lastUse: "2023-08-13T04:00:00Z",
        };
        const repos = sortSuggestedRepositories([repo1, repo2, repo3, repo4]);
        expect(repos[0].url).equals(repo1.url);
        expect(repos[1].url).equals(repo2.url);
        expect(repos[2].url).equals(repo4.url);
        expect(repos[3].url).equals(repo3.url);
    }

    @test
    public testProjectWithLastUseSorting() {
        // represents a project
        const project1 = {
            priority: PRIORITY_HIGH,
            url: "https://github.com/repo1",
            projectName: "Project A",
        };
        // represents another project
        const project2 = {
            priority: PRIORITY_HIGH,
            url: "https://github.com/repo2",
            projectName: "Project B",
        };
        // represents a workspace started for a project
        // repo3 should get merged into project2 (same url) so lastUse can be considered
        const repo3 = {
            priority: PRIORITY_LOW,
            url: "https://github.com/repo2",
            repositoryName: "Repo 2",
            lastUse: "2023-08-13T04:00:00Z",
        };

        const repos = sortSuggestedRepositories([project1, project2, repo3]);
        expect(repos).lengthOf(2);
        expect(repos[0].url).equals(project2.url);
        expect(repos[1].url).equals(project1.url);
    }
}

module.exports = new TestSuggestedReposSorter();
