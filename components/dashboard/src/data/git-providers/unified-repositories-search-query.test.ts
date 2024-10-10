/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { SuggestedRepository } from "@gitpod/public-api/lib/gitpod/v1/scm_pb";
import { deduplicateAndFilterRepositories, isValidGitUrl } from "./unified-repositories-search-query";

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

test("should perform weak validation for git URLs", () => {
    expect(isValidGitUrl("a:")).toEqual(false);
    expect(isValidGitUrl("a:b")).toEqual(false);
    expect(isValidGitUrl("https://b")).toEqual(false);
    expect(isValidGitUrl("https://b/repo.git")).toEqual(false);
    expect(isValidGitUrl("https://b.com/repo.git")).toEqual(true);
    expect(isValidGitUrl("git@a.b:")).toEqual(false);
    expect(isValidGitUrl("blib@a.b:")).toEqual(false);
    expect(isValidGitUrl("blib@a.b:22:")).toEqual(false);
    expect(isValidGitUrl("blib@a.b:g/g")).toEqual(true);

    // some "from the wild" cases
    expect(isValidGitUrl("https://github.com/gitpod-io/gitpod/pull/20281")).toEqual(true);
    expect(isValidGitUrl("https://gitlab.com/filiptronicek/gitpod.git")).toEqual(true);
    expect(isValidGitUrl("git@github.com:gitpod-io/gitpod.git")).toEqual(true);
    expect(isValidGitUrl("git@gitlab.com:filiptronicek/gitpod.git")).toEqual(true);
    expect(isValidGitUrl("ssh://login@server.com:12345/~/repository.git")).toBe(true);
    expect(isValidGitUrl("https://bitbucket.gitpod-dev.com/scm/~geropl/test-user-repo.git")).toBe(true);
    expect(isValidGitUrl("git://gitlab.com/gitpod/spring-petclinic")).toBe(true);
    expect(isValidGitUrl("git@ssh.dev.azure.com:v3/services-azure/open-to-edit-project2/open-to-edit-project2")).toBe(
        true,
    );
});
