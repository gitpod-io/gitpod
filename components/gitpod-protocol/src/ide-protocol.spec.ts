/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { suite, test } from "mocha-typescript";
import * as chai from "chai";
import { makeIdeVersionHumanReadable } from ".";

const expect = chai.expect;

@suite
class TestIdeProtocol {
    @test public testSuffixedIdeVersion() {
        const versionString = "v1.74.0-insider";

        expect(makeIdeVersionHumanReadable(versionString)).to.deep.equal("v1.74.0 Insider");
    }
    @test public testUnsuffixedIdeVersion() {
        const versionString = "v1.74.0";

        expect(makeIdeVersionHumanReadable(versionString)).to.deep.equal("v1.74.0");
    }
}
module.exports = new TestIdeProtocol(); // Only to circumvent no usage warning :-/
