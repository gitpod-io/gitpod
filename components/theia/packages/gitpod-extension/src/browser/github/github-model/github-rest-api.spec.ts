/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */


import * as assert from 'assert';
import { suite, test } from "mocha-typescript"
import { TEST_TOKENS, TestGitHubComRestApi } from '../github-model/setup.test';
import { GitHubApiError } from './github';

@suite.skip
export class GitHubRestApiTests {

    static before() {
        (global as any).fetch = require("node-fetch");
        (global as any).window = {
            location: {
                hostname: "test"
            }
        }
    }

    @test async "get my login"() {
        const restApi = new TestGitHubComRestApi(TEST_TOKENS.READ_EMAIL_PERMISSION);
        const myLogin = await restApi.getMyLogin();
        assert.equal(myLogin.data.login, "somefox");
        assert.equal((myLogin.headers as any)['x-oauth-scopes'], "user:email");
    }

    @test async "get my authorized organizations fails with 403"() {
        const restApi = new TestGitHubComRestApi(TEST_TOKENS.READ_EMAIL_PERMISSION);
        try {
            await restApi.getAuthorizedOrganizations();
        } catch (error) {
            if (GitHubApiError.is(error)) {
                assert.equal(error.headers['x-oauth-scopes'], "user:email");
                return;
            }
        }
        assert.fail('Requesting authorized organizations should have failed with 403.')
    }

}
