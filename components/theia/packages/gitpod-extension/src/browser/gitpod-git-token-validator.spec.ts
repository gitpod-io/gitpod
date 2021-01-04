/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */


import * as assert from 'assert';
import { suite, test } from "mocha-typescript"
import { TEST_TOKENS } from './github/github-model/setup.test';
import { GitpodGitTokenValidator } from './gitpod-git-token-validator';

@suite.skip
export class GitpodGitTokenValidatorTests {

    static before() {
        (global as any).fetch = require("node-fetch");
        (global as any).window = {
            location: {
                hostname: "test"
            }
        }
    }

    @test async "somefox/theia is accessible"() {
        const validator = new GitpodGitTokenValidator();
        const results = await validator.checkWriteAccessForGitHubRepo(TEST_TOKENS.READ_EMAIL_PERMISSION, "github.com", "somefox/theia");
        assert.notEqual(results, undefined);
        assert.equal(results!.writeAccessToRepo, true);
    }

    @test async "eclipse-theia/theia is not accessible"() {
        const validator = new GitpodGitTokenValidator();
        const results = await validator.checkWriteAccessForGitHubRepo(TEST_TOKENS.READ_EMAIL_PERMISSION, "github.com", "eclipse-theia/theia");
        assert.notEqual(results, undefined);
        assert.equal(results!.writeAccessToRepo, false);
    }

    @test async "wearebraid/vue-formulate is not accessible"() {
        const validator = new GitpodGitTokenValidator();
        const results = await validator.checkWriteAccessForGitHubRepo(TEST_TOKENS.READ_EMAIL__READ_ORG__WRITE_PRIVATE__PERMISSION, "github.com", "wearebraid/vue-formulate");
        assert.notEqual(results, undefined);
        assert.equal(results!.writeAccessToRepo, false);
    }

    @test async "eclipse-theia/maybe-private is not accessible"() {
        const validator = new GitpodGitTokenValidator();
        const results = await validator.checkWriteAccessForGitHubRepo(TEST_TOKENS.READ_EMAIL_PERMISSION, "github.com", "eclipse-theia/maybe-private");
        assert.notEqual(results, undefined);
        assert.equal(results!.found, false);
        assert.equal(results!.writeAccessToRepo, undefined);
    }

}
