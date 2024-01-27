/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { suite, test } from "@testdeck/mocha";
import * as chai from "chai";

import { UserEnvVar } from "./protocol";

const expect = chai.expect;

@suite
class TestUserEnvVar {
    public before() {}

    @test public testMatchEnvVarPattern() {
        interface Test {
            pattern: string;
            repository: string;
            result: boolean;
        }
        const tests: Test[] = [
            {
                pattern: "*/*",
                repository: "some/repo",
                result: true,
            },
            {
                pattern: "*/*",
                repository: "some/nested/repo",
                result: false,
            },
            {
                pattern: "*/*",
                repository: "some/nested/deeply/repo",
                result: false,
            },
            {
                pattern: "some/*",
                repository: "some/repo",
                result: true,
            },
            {
                pattern: "some/*",
                repository: "some/nested/repo",
                result: false,
            },
            {
                pattern: "some/*",
                repository: "some/nested/deeply/repo",
                result: false,
            },
            {
                pattern: "some/**",
                repository: "some/repo",
                result: true,
            },
            {
                pattern: "some/**",
                repository: "some/nested/repo",
                result: true,
            },
            {
                pattern: "some/**",
                repository: "some/nested/deeply/repo",
                result: true,
            },
            {
                pattern: "some/nested/*",
                repository: "some/repo",
                result: false,
            },
            {
                pattern: "some/nested/*",
                repository: "some/nested/repo",
                result: true,
            },
            {
                pattern: "some/nested/*",
                repository: "some/nested/deeply/repo",
                result: false,
            },
            {
                pattern: "some/nested/*",
                repository: "another/repo",
                result: false,
            },
            {
                pattern: "some/nested/**",
                repository: "some/nested/repo",
                result: true,
            },
            {
                pattern: "some/nested/**",
                repository: "some/nested/deeply/repo",
                result: true,
            },
            {
                pattern: "some/nested/**",
                repository: "another/repo",
                result: false,
            },
            {
                pattern: "*/repo",
                repository: "some/repo",
                result: true,
            },
            {
                pattern: "*/repo",
                repository: "some/nested/repo",
                result: false,
            },
            {
                pattern: "*/repo",
                repository: "some/nested/deeply/repo",
                result: false,
            },
            {
                pattern: "*/repo",
                repository: "another/repo",
                result: true,
            },
            {
                pattern: "*/*/repo",
                repository: "some/repo",
                result: false,
            },
            {
                pattern: "*/*/repo",
                repository: "some/nested/repo",
                result: true,
            },
            {
                pattern: "*/*/repo",
                repository: "some/nested/deeply/repo",
                result: false,
            },
            {
                pattern: "*/*/repo",
                repository: "another/repo",
                result: false,
            },
        ];

        for (const test of tests) {
            const actual = UserEnvVar.matchEnvVarPattern(test.pattern, test.repository);
            expect(actual, `'${test.repository}' % '${test.pattern}' -> ${test.result}`).to.eq(test.result);
        }
    }
}

module.exports = new TestUserEnvVar();
