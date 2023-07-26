/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { ApplicationError, ErrorCode } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { expect } from "chai";

export async function expectError(errorCode: ErrorCode, code: Promise<any> | (() => Promise<any>)) {
    try {
        await (code instanceof Function ? code() : code);
        expect.fail("expected error: " + errorCode);
    } catch (err) {
        if (!ApplicationError.hasErrorCode(err)) {
            throw err;
        }
        expect(err && ApplicationError.hasErrorCode(err) && err.code).to.equal(errorCode);
    }
}
