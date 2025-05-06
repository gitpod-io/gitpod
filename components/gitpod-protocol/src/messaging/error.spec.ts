/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { suite, test } from "@testdeck/mocha";
import { ApplicationError, ErrorCodes } from "./error";

import { expect } from "chai";

@suite
class TestApplicationError {
    @test public async ApplicationError_isUserDeletedError() {
        expect(
            ApplicationError.isUserDeletedError(
                new ApplicationError(ErrorCodes.NOT_FOUND, "not found", { userDeleted: true }),
            ),
        ).to.be.true;
    }
}
module.exports = new TestApplicationError();
