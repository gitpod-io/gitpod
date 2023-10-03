/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { suite, test } from "@testdeck/mocha";
import { PersonalAccessToken } from "./bearer-authenticator";
import { expect } from "chai";

@suite()
class TestPersonalAccessToken {
    @test
    test_parse_token_ok() {
        const token = "gitpod_pat_GrvGthczSRf3ypqFhNtcRiN5fK6CV7rdCkkPLfpbc_4." + "test".repeat(10);

        const parsed = PersonalAccessToken.parse(token);
        const expected = new PersonalAccessToken("GrvGthczSRf3ypqFhNtcRiN5fK6CV7rdCkkPLfpbc_4", "test".repeat(10));
        expect(parsed).to.deep.equal(expected);
    }

    @test
    test_parse_token_throws() {
        const tokens = [
            "gitpod_pat_GrvGthczSRf3ypqFhNtcRiN5fK6CV7rdCkkPLfpbc_4.", // no value
            `gitpod_pat_.${"test".repeat(10)}`, // no signature
            `something_GrvGthczSRf3ypqFhNtcRiN5fK6CV7rdCkkPLfpbc_4.${"test".repeat(10)}`, // invalid prefix
        ];

        tokens.forEach((token) => {
            expect(() => PersonalAccessToken.parse(token)).to.throw();
        });
    }
}

module.exports = new TestPersonalAccessToken();
