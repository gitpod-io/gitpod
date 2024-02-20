/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { expect } from "chai";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { getPrebuildErrorMessage, matchPrebuildError } from "./prebuild-utils";

describe("PrebuildUtils", () => {
    describe("PrebuildErrorMessage", () => {
        it("Application Error", async () => {
            const errorList = [
                new ApplicationError(ErrorCodes.UNIMPLEMENTED, "not implemented"),
                new ApplicationError(ErrorCodes.INTERNAL_SERVER_ERROR, "not implemented#"),
                new ApplicationError(ErrorCodes.NOT_FOUND, "#not implemented#"),
                new ApplicationError(ErrorCodes.NOT_FOUND, "#not#implemented#"),
                new ApplicationError(ErrorCodes.NOT_FOUND, "12312#not#implemented#"),
            ];
            for (const err of errorList) {
                const msg = getPrebuildErrorMessage(err);
                const result = matchPrebuildError(msg);
                expect(result).to.not.undefined;
                expect(result?.code).to.equal(err.code);
                expect(result?.message).to.equal(err.message);
            }
        });

        it("Error", async () => {
            const errorList = [
                new Error("not implemented"),
                new Error("not implemented#"),
                new Error("#not implemented#"),
                new Error("#not#implemented#"),
                new Error("12312#not#implemented#"),
            ];
            for (const err of errorList) {
                const msg = getPrebuildErrorMessage(err);
                const result = matchPrebuildError(msg);
                expect(result).to.not.undefined;
                expect(result?.code).to.equal(ErrorCodes.INTERNAL_SERVER_ERROR);
                expect(result?.message).to.equal(err.message);
            }
        });

        it("others", async () => {
            const errorList = [{}, [], Symbol("hello")];
            for (const err of errorList) {
                const msg = getPrebuildErrorMessage(err);
                const result = matchPrebuildError(msg);
                expect(result).to.not.undefined;
                expect(result?.code).to.equal(ErrorCodes.INTERNAL_SERVER_ERROR);
                expect(result?.message).to.equal("unknown error");
            }
        });
    });

    describe("matchPrebuildError", () => {
        it("happy path", async () => {
            const result = matchPrebuildError(
                "X-Prebuild-Error#404#Headless logs for 07f877b5-631c-47c8-82aa-09de2f11fff3 not found#X-Prebuild-Error",
            );
            expect(result).to.not.undefined;
            expect(result?.code).to.be.equal(404);
            expect(result?.message).to.be.equal("Headless logs for 07f877b5-631c-47c8-82aa-09de2f11fff3 not found");
        });

        it("not match", async () => {
            const result = matchPrebuildError("echo hello");
            expect(result).to.be.undefined;
        });
    });
});
