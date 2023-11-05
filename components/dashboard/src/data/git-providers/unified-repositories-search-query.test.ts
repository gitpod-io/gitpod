/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { SuggestedRepository } from "@gitpod/gitpod-protocol";
import { deduplicateAndFilterRepositories } from "./unified-repositories-search-query";

function repo(name: string, project?: string): SuggestedRepository {
    return {
        url: `http://github.com/efu3he4rf/${name}`,
        repositoryName: name,
        projectName: project,
        projectId: project,
    };
}

test("it should deduplicate non-project entries", () => {
    const suggestedRepos: SuggestedRepository[] = [repo("foo"), repo("foo2"), repo("foo", "project-foo")];
    const deduplicated = deduplicateAndFilterRepositories("foo", false, suggestedRepos);
    expect(deduplicated.length).toEqual(2);
    expect(deduplicated[1].projectName).toEqual("project-foo");
});

test("it should not deduplicate project entries", () => {
    const suggestedRepos: SuggestedRepository[] = [
        repo("foo", "project-foo2"),
        repo("foo2"),
        repo("foo", "project-foo"),
    ];
    const deduplicated = deduplicateAndFilterRepositories("foo", false, suggestedRepos);
    expect(deduplicated.length).toEqual(3);
});

test("it should exclude project entries", () => {
    const suggestedRepos: SuggestedRepository[] = [
        repo("foo", "project-foo2"),
        repo("foo2"),
        repo("foo", "project-foo"),
    ];
    const deduplicated = deduplicateAndFilterRepositories("foo", true, suggestedRepos);
    expect(deduplicated.length).toEqual(1);
});

test("it should match entries in url as well as poject name", () => {
    const suggestedRepos: SuggestedRepository[] = [
        repo("somefOOtest"),
        repo("Footest"),
        repo("somefoO"),
        repo("bar", "somefOO"),
        repo("bar", "someFootest"),
        repo("bar", "FOOtest"),
    ];
    var deduplicated = deduplicateAndFilterRepositories("foo", false, suggestedRepos);
    expect(deduplicated.length).toEqual(6);
    deduplicated = deduplicateAndFilterRepositories("foot", false, suggestedRepos);
    expect(deduplicated.length).toEqual(4);
    deduplicated = deduplicateAndFilterRepositories("FOOT", false, suggestedRepos);
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
    ];
    const deduplicated = deduplicateAndFilterRepositories("foot", false, suggestedRepos);
    expect(deduplicated[0].repositoryName).toEqual("somefOOtest");
    expect(deduplicated[1].repositoryName).toEqual("Footest");
    expect(deduplicated[2].projectName).toEqual("someFootest");
    expect(deduplicated[3].projectName).toEqual("FOOtest");
});
