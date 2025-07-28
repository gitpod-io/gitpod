/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { expect } from "chai";
import { ensureUrlHasFragment } from "./fragment-utils";

describe("Fragment Protection", () => {
    describe("ensureUrlHasFragment", () => {
        it("should add empty fragment to URL without fragment", () => {
            const url = "https://gitpod.io/workspaces";
            const result = ensureUrlHasFragment(url);

            expect(result).to.equal("https://gitpod.io/workspaces#");
        });

        it("should preserve existing fragment", () => {
            const url = "https://gitpod.io/workspaces#existing";
            const result = ensureUrlHasFragment(url);

            expect(result).to.equal(url);
        });

        it("should handle URLs with query parameters", () => {
            const url = "https://gitpod.io/workspaces?tab=recent";
            const result = ensureUrlHasFragment(url);

            expect(result).to.equal("https://gitpod.io/workspaces?tab=recent#");
        });

        it("should handle invalid URLs gracefully", () => {
            const url = "not-a-valid-url";
            const result = ensureUrlHasFragment(url);

            expect(result).to.equal("not-a-valid-url#");
        });

        it("should prevent OAuth token inheritance attack", () => {
            // Scenario: OAuth provider redirects with token in fragment
            // If returnTo URL has no fragment, browser inherits the token fragment
            const returnToWithoutFragment = "https://gitpod.io/workspaces";
            const protectedUrl = ensureUrlHasFragment(returnToWithoutFragment);

            // Now when OAuth provider redirects to: protectedUrl + token fragment
            // The existing fragment prevents inheritance
            expect(protectedUrl).to.include("#");
            expect(protectedUrl).to.not.equal(returnToWithoutFragment);
        });
    });
});
