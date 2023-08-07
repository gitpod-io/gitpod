/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { ApplicationError, ErrorCode } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { expect } from "chai";

export async function expectError(errorCode: ErrorCode, code: Promise<any> | (() => Promise<any>), message?: string) {
    const msg = "expected error: " + errorCode + (message ? " - " + message : "");
    try {
        await (code instanceof Function ? code() : code);
        expect.fail(msg + " - succeeded");
    } catch (err) {
        if (!ApplicationError.hasErrorCode(err)) {
            throw err;
        }
        const actual = err && ApplicationError.hasErrorCode(err) && err.code;
        expect(actual, msg + " - got: " + actual).to.equal(errorCode);
    }
}
