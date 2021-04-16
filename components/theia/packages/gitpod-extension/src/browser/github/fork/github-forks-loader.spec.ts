/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */


import * as assert from 'assert';
import { suite, test, timeout } from "mocha-typescript"
import { GitHubForksLoader } from './github-forks-loader';
import { BatchLoader } from '../github-model/batch-loader';
import { TEST_TOKENS, TestGitHubComEndpoint, TestGitHubComRestApi } from '../github-model/setup.test';

@suite.skip
export class ForksLoaderTests {

    static before() {
        (global as any).fetch = require("node-fetch");
        (global as any).window = {
            location: {
                hostname: "test"
            }
        }
    }

    @test async "find forks in organization"() {
        const ghEndpoint = new TestGitHubComEndpoint(TEST_TOKENS.READ_EMAIL_PERMISSION);
        const ghRestApi = new TestGitHubComRestApi(TEST_TOKENS.READ_EMAIL_PERMISSION);

        const orgCandidates = ["cool-test-org", "gitpod-io", "TypeFox"];
        const repo = { owner: "mdn", name: "django-locallibrary-tutorial" };

        const loader = new BatchLoader(ghEndpoint);
        const forksInCandidateOrgsPromise = new GitHubForksLoader(ghEndpoint, ghRestApi).getForksInOrganizations(repo, orgCandidates, loader);
        await loader.load();
        const forksInCandidateOrgs = await forksInCandidateOrgsPromise;
        assert.equal(forksInCandidateOrgs.length, 2);
        assert.equal(forksInCandidateOrgs[0].owner, "cool-test-org");
    }

    @test @timeout(6000) async "compute fork menu options – (read:email)"() {
        const ghEndpoint = new TestGitHubComEndpoint(TEST_TOKENS.READ_EMAIL_PERMISSION);
        const ghRestApi = new TestGitHubComRestApi(TEST_TOKENS.READ_EMAIL_PERMISSION);
        const forksLoader = new GitHubForksLoader(ghEndpoint, ghRestApi);

        const repo = { owner: "mdn", name: "django-locallibrary-tutorial" };
        const options = await forksLoader.computeForkMenuOptions(repo);

        assert.equal(options.missingPermissions.length, 2);
        assert.equal(!!options.missingPermissions.find(x => x.scope === "read:org"), true);
        assert.equal(!!options.missingPermissions.find(x => x.scope === "public_repo"), true);

        assert.equal(options.switchToForkOfOwners.length, 1);
        assert.equal(options.switchToForkOfOwners[0], "somefox");
    }

    @test @timeout(5000) async "compute fork menu options – (read:email,read:org,public_repo)"() {
        const ghEndpoint = new TestGitHubComEndpoint(TEST_TOKENS.READ_EMAIL__READ_ORG__WRITE_PUBLIC__PERMISSION);
        const ghRestApi = new TestGitHubComRestApi(TEST_TOKENS.READ_EMAIL__READ_ORG__WRITE_PUBLIC__PERMISSION);
        const forksLoader = new GitHubForksLoader(ghEndpoint, ghRestApi);

        const repo = { owner: "mdn", name: "django-locallibrary-tutorial" };
        const options = await forksLoader.computeForkMenuOptions(repo);
        assert.equal(options.missingPermissions.length, 0);

        assert.equal(options.switchToForkOfOwners.length, 2);
        assert.equal(options.switchToForkOfOwners[0], "somefox");
        assert.equal(options.switchToForkOfOwners[1], "cool-test-org");
    }

}
