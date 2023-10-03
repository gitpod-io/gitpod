/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import "reflect-metadata";

import { suite, test } from "@testdeck/mocha";
import { expect } from "chai";
import {
    sortSuggestedRepositories,
    suggestionFromProject,
    suggestionFromRecentWorkspace,
    suggestionFromUserRepo,
} from "./suggested-repos-sorter";

@suite
class TestSuggestedReposSorter {
    @test
    public testUserReposOnly() {
        const entry1 = suggestionFromUserRepo({
            url: "https://github.com/repo1",
            repositoryName: "Repo 1",
        });
        const entry2 = suggestionFromUserRepo({
            url: "https://github.com/repo2",
            repositoryName: "Repo 2",
        });
        const sortedRepos = sortSuggestedRepositories([entry2, entry1]);
        expect(sortedRepos).lengthOf(2);
        expect(sortedRepos[0].url).equals(entry1.url);
        expect(sortedRepos[1].url).equals(entry2.url);
    }

    public testRecentWorkspacesOnly() {
        const entry1 = suggestionFromRecentWorkspace(
            {
                url: "https://github.com/repo1",
                repositoryName: "Repo 1",
            },
            "2023-08-13T01:00:00Z",
        );
        const entry2 = suggestionFromRecentWorkspace(
            {
                url: "https://github.com/repo2",
                repositoryName: "Repo 2",
            },
            "2023-08-13T02:00:00Z",
        );
        const entry3 = suggestionFromRecentWorkspace(
            {
                url: "https://github.com/repo3",
                repositoryName: "Repo 3",
            },
            "2023-08-13T02:00:00Z",
        );

        const sortedRepos = sortSuggestedRepositories([entry1, entry2, entry3]);
        expect(sortedRepos).lengthOf(3);
        expect(sortedRepos[0].url).equals(entry1.url);
        expect(sortedRepos[1].url).equals(entry2.url);
        expect(sortedRepos[2].url).equals(entry3.url);
    }

    @test
    public testProjectsOnly() {
        const entry = suggestionFromUserRepo({
            url: "https://github.com/repo1",
        });
        const repo2 = suggestionFromUserRepo({
            url: "https://github.com/repo2",
        });
        const sortedRepos = sortSuggestedRepositories([entry, repo2]);
        expect(sortedRepos[0].url).equals(entry.url);
        expect(sortedRepos[1].url).equals(repo2.url);
    }

    @test
    public testAlphaSortingWithNames() {
        const repo1 = suggestionFromProject({
            url: "https://github.com/repo1",
            projectName: "Project A",
            repositoryName: "Repo 1",
        });
        const repo2 = suggestionFromProject({
            url: "https://github.com/repo2",
            projectName: "Project B",
            repositoryName: "Repo 2",
        });
        const repo3 = suggestionFromProject({
            url: "https://github.com/repo3",
            projectName: "Project C",
        });
        const repo4 = suggestionFromProject({
            url: "https://github.com/repo4",
            repositoryName: "A Great Repo",
        });
        const repo5 = suggestionFromProject({
            url: "https://github.com/repo5",
        });
        const repos = sortSuggestedRepositories([repo1, repo2, repo3, repo4, repo5]);
        expect(repos[0].url).equals(repo4.url);
        expect(repos[1].url).equals(repo5.url);
        expect(repos[2].url).equals(repo1.url);
        expect(repos[3].url).equals(repo2.url);
        expect(repos[4].url).equals(repo3.url);
    }

    @test
    public testWithAllEntryTypes() {
        const entry1 = suggestionFromProject({
            url: "https://github.com/repo1",
            projectName: "Project A",
        });
        const entry2 = suggestionFromUserRepo({
            url: "https://github.com/repo2",
            repositoryName: "Repo 2",
        });
        const entry3 = suggestionFromRecentWorkspace(
            {
                url: "https://github.com/repo1",
                repositoryName: "Repo 1",
            },
            "2023-08-13T01:00:00Z",
        );

        const entry4 = suggestionFromRecentWorkspace(
            {
                url: "https://github.com/repo4",
                repositoryName: "Repo 4",
            },
            "2023-08-13T04:00:00Z",
        );
        const repos = sortSuggestedRepositories([entry1, entry2, entry3, entry4]);
        expect(repos).lengthOf(3);
        expect(repos[0].url).equals(entry1.url);
        expect(repos[1].url).equals(entry4.url);
        expect(repos[2].url).equals(entry2.url);
    }

    @test
    public testProjectWithRecentWorkspaceSorting() {
        // represents a project
        const entry1 = suggestionFromProject({
            url: "https://github.com/repo1",
            projectName: "Project A",
        });
        // represents another project
        const entry2 = suggestionFromProject({
            url: "https://github.com/repo2",
            projectName: "Project B",
        });
        // represents a workspace started for project2 (same url)
        const entry3 = suggestionFromRecentWorkspace(
            {
                url: "https://github.com/repo2",
                repositoryName: "Repo 2",
            },
            "2023-08-13T04:00:00Z",
        );

        const repos = sortSuggestedRepositories([entry1, entry2, entry3]);
        expect(repos).lengthOf(2);
        expect(repos[0].url).equals(entry2.url);
        expect(repos[1].url).equals(entry1.url);
    }

    @test
    public testRecentWorkspaceEntryBeforeUnusedProjects() {
        const entry1 = suggestionFromProject({
            url: "https://github.com/repo1",
            projectName: "Project A",
        });
        const entry2 = suggestionFromProject({
            url: "https://github.com/repo2",
            projectName: "Project B",
        });

        // represents a workspace started for a project
        // repo3 should get merged into project2 (same url) so lastUse can be considered
        const entry3 = suggestionFromRecentWorkspace(
            {
                url: "https://github.com/repo3",
                repositoryName: "Repo 2",
            },
            "2023-08-13T04:00:00Z",
        );

        const repos = sortSuggestedRepositories([entry1, entry2, entry3]);
        expect(repos).lengthOf(3);
        expect(repos[0].url).equals(entry3.url);
        expect(repos[1].url).equals(entry1.url);
        expect(repos[2].url).equals(entry2.url);
    }
}

module.exports = new TestSuggestedReposSorter();
