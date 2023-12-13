/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import "mocha";
import * as chai from "chai";
import { containsScopes } from "./token-scopes-inclusion";

const expect = chai.expect;

describe("containsScopes", () => {
    it("should return true if all required scopes are included in the existing scopes", () => {
        const existingScopes = ["repo", "read:user"];
        const requiredScopes = ["repo"];
        const result = containsScopes(existingScopes, requiredScopes);
        expect(result).to.be.true;
    });

    it("should return false if not all required scopes are included in the existing scopes", () => {
        const existingScopes = ["read:user"];
        const requiredScopes = ["repo"];
        const result = containsScopes(existingScopes, requiredScopes);
        expect(result).to.be.false;
    });

    it("should return false if the existing scopes are undefined", () => {
        const existingScopes = undefined;
        const requiredScopes = ["repo"];
        const result = containsScopes(existingScopes, requiredScopes);
        expect(result).to.be.false;
    });

    it("should return true if the existing scopes equal required scopes", () => {
        const existingScopes = ["repo"];
        const requiredScopes = ["repo"];
        const result = containsScopes(existingScopes, requiredScopes);
        expect(result).to.be.true;
    });

    it("should return true if the required scopes are empty", () => {
        const existingScopes = ["repo"];
        const requiredScopes: string[] = [];
        const result = containsScopes(existingScopes, requiredScopes);
        expect(result).to.be.true;
    });
});
