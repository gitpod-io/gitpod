/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { suite, test } from "@testdeck/mocha";
import { log } from "./logging";

@suite
class TestLogging {
    @test public async testLogInfo_output() {
        const testObj = {
            null: null,
            undefined: undefined,
            empty: "",
            foo: "bar",
            number: 0,
        };
        log.info("info logging test", testObj);
    }
}
module.exports = new TestLogging();
