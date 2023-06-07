/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import * as chai from "chai";
import { suite, test } from "mocha-typescript";
import { scrubValue } from "./scrubbing";
const expect = chai.expect;

@suite
export class ScrubbingTest {
    @test public testValue_EmptyString() {
        expect(scrubValue("")).to.equal("");
    }
    @test public testValue_Email() {
        expect(scrubValue("foo@bar.com")).to.equal("[redacted:md5:f3ada405ce890b6f8204094deb12d8a8:email]");
    }
    @test public testValue_EmailInText() {
        expect(scrubValue("The email is foo@bar.com or bar@foo.com")).to.equal(
            "The email is [redacted:md5:f3ada405ce890b6f8204094deb12d8a8:email] or [redacted:md5:dc8a42aba3651b0b1f088ef928ff3b1d:email]",
        );
    }
}
module.exports = new ScrubbingTest();
