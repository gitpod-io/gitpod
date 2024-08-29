/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { SuggestedRepository } from "@gitpod/public-api/lib/gitpod/v1/scm_pb";
import { deduplicateAndFilterRepositories } from "./unified-repositories-search-query";

function repo(name: string, project?: string): SuggestedRepository {
    return new SuggestedRepository({
        url: `http://github.com/efu3he4rf/${name}`,
        repoName: name,
        configurationName: project,
        configurationId: project,
    });
}

test("it should deduplicate non-project entries", () => {
    const suggestedRepos: SuggestedRepository[] = [repo("foo"), repo("foo2"), repo("foo", "project-foo")];
    const deduplicated = deduplicateAndFilterRepositories("foo", false, false, suggestedRepos);
    expect(deduplicated.length).toEqual(2);
    expect(deduplicated[1].configurationName).toEqual("project-foo");
});

test("it should not deduplicate project entries", () => {
    const suggestedRepos: SuggestedRepository[] = [
        repo("foo", "project-foo2"),
        repo("foo2"),
        repo("foo", "project-foo"),
    ];
    const deduplicated = deduplicateAndFilterRepositories("foo", false, false, suggestedRepos);
    expect(deduplicated.length).toEqual(3);
});

test("it should exclude project entries", () => {
    const suggestedRepos: SuggestedRepository[] = [
        repo("foo", "project-foo2"),
        repo("foo2"),
        repo("foo", "project-foo"),
    ];
    const deduplicated = deduplicateAndFilterRepositories("foo", true, false, suggestedRepos);
    expect(deduplicated.length).toEqual(2);
    expect(deduplicated[0].repoName).toEqual("foo");
    expect(deduplicated[1].repoName).toEqual("foo2");
});

test("it should match entries in url as well as project name", () => {
    const suggestedRepos: SuggestedRepository[] = [
        repo("somefOOtest"),
        repo("Footest"),
        repo("somefoO"),
        repo("bar", "somefOO"),
        repo("bar", "someFootest"),
        repo("bar", "FOOtest"),
    ];
    let deduplicated = deduplicateAndFilterRepositories("foo", false, false, suggestedRepos);
    expect(deduplicated.length).toEqual(6);
    deduplicated = deduplicateAndFilterRepositories("foot", false, false, suggestedRepos);
    expect(deduplicated.length).toEqual(4);
    deduplicated = deduplicateAndFilterRepositories("FOOT", false, false, suggestedRepos);
    expect(deduplicated.length).toEqual(4);
});

test("it keeps the order", () => {
    const suggestedRepos: SuggestedRepository[] = [
        repo("somefOOtest"),
        repo("Footest"),
        repo("somefoO"),
        repo("bar", "somefOO"),
        repo("bar", "someFootest"),
        repo("bar", "FOOtest"),
        repo("bar", "somefOO"),
    ];
    const deduplicated = deduplicateAndFilterRepositories("foot", false, false, suggestedRepos);
    expect(deduplicated[0].repoName).toEqual("somefOOtest");
    expect(deduplicated[1].repoName).toEqual("Footest");
    expect(deduplicated[2].configurationName).toEqual("someFootest");
    expect(deduplicated[3].configurationName).toEqual("FOOtest");

    const deduplicatedNoSearch = deduplicateAndFilterRepositories("", false, false, suggestedRepos);
    expect(deduplicatedNoSearch.length).toEqual(6);
});

test("it should return all repositories without duplicates when excludeProjects is true", () => {
    const suggestedRepos: SuggestedRepository[] = [
        repo("foo"),
        repo("foo", "project-foo"),
        repo("foo", "project-bar"),
        repo("bar", "project-foo"),
        repo("bar", "project-bar"),
    ];
    const deduplicated = deduplicateAndFilterRepositories("foo", true, false, suggestedRepos);
    expect(deduplicated.length).toEqual(2);
    expect(deduplicated[0].repoName).toEqual("foo");
    expect(deduplicated[1].repoName).toEqual("bar");
});
