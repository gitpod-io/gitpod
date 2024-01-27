/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import * as chai from "chai";
import { suite, test } from "@testdeck/mocha";
import { formatPhoneNumber } from "./phone-numbers";
const expect = chai.expect;

@suite
export class PhoneNumberSpec {
    @test public testFormatPhoneNumber() {
        const tests = [
            ["00123234254", "+123234254"],
            ["+1 232 34 254", "+123234254"],
            ["001 23234-254", "+123234254"],
            ["0012swedfkwejfew32sdf3sdvsf sdv fsdv4254", "+123234254"],
        ];

        for (const test of tests) {
            expect(formatPhoneNumber(test[0]), "Values : " + JSON.stringify(test)).to.eq(test[1]);
        }
    }
}
module.exports = new PhoneNumberSpec();
