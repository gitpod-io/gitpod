/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import * as chai from "chai";
import { suite, test } from "@testdeck/mocha";
import { TrustedValue, scrubber } from "./scrubbing";
const expect = chai.expect;

@suite
export class ScrubbingTest {
    @test public testValue_EmptyString() {
        expect(scrubber.scrub("")).to.equal("");
    }
    @test public testValue_Email() {
        expect(scrubber.scrub("foo@bar.com")).to.equal("[redacted:email]");
    }
    @test public testValue_EmailInText() {
        expect(scrubber.scrub("The email is foo@bar.com or bar@foo.com")).to.equal(
            "The email is [redacted:email] or [redacted:email]",
        );
    }

    @test public testKeyValue_Email() {
        expect(scrubber.scrub({ email: "testvalue" })).to.deep.equal({ email: "[redacted]" });
    }
    @test public testKeyValue_AuthorEmail() {
        expect(scrubber.scrub({ author_email: "testvalue" })).to.deep.equal({ author_email: "[redacted]" });
    }
    @test public testKeyValue_Token() {
        expect(scrubber.scrub({ token: "testvalue" })).to.deep.equal({ token: "[redacted]" });
    }
    @test public testKeyValue_OwnerToken() {
        expect(scrubber.scrub({ owner_token: "testvalue" })).to.deep.equal({ owner_token: "[redacted]" });
    }

    @test public testKeyValue_NestedObject() {
        expect(scrubber.scrub({ key: { owner_token: "testvalue" } }, true)).to.deep.equal({
            key: { owner_token: "[redacted]" },
        });
    }
    @test public testKeyValue_NoNestedObject() {
        expect(scrubber.scrub({ key: { owner_token: "testvalue" } }, false)).to.deep.equal({
            key: "[redacted:nested:object}]",
        });
    }

    @test public testKeyValue_NestedArray() {
        expect(scrubber.scrub([["foo@bar.com"]])).to.deep.equal([["[redacted:email]"]]);
    }

    @test public testKeyValue_NoNestedArray() {
        expect(scrubber.scrub([["foo@bar.com"]], false)).to.deep.equal(["[redacted:nested:array]"]);
    }

    @test public testKeyValue_Scrubbable() {
        const scrubbedValue = new TrustedValue(scrubber.scrubValue("foo@bar.com"));
        expect(scrubber.scrub({ key: scrubbedValue })).to.deep.equal({ key: "[redacted:email]" });
    }
}
module.exports = new ScrubbingTest();
