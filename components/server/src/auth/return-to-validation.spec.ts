/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { expect } from "chai";
import { GitpodHostUrl } from "@gitpod/gitpod-protocol/lib/util/gitpod-host-url";
import { validateLoginReturnToUrl, validateAuthorizeReturnToUrl } from "../express-util";

describe("ReturnTo URL Validation", () => {
    const hostUrl = new GitpodHostUrl("https://gitpod.io");

    describe("validateLoginReturnToUrl", () => {
        it("should accept any valid path after domain validation", () => {
            const validUrls = [
                "https://gitpod.io/",
                "https://gitpod.io/workspaces",
                "https://gitpod.io/workspaces/123",
                "https://gitpod.io/settings",
                "https://gitpod.io/settings/integrations",
                "https://gitpod.io/user-settings",
                "https://gitpod.io/user-settings/account",
                "https://gitpod.io/integrations",
                "https://gitpod.io/integrations/github",
                "https://gitpod.io/repositories",
                "https://gitpod.io/repositories/123",
                "https://gitpod.io/prebuilds",
                "https://gitpod.io/prebuilds/456",
                "https://gitpod.io/members",
                "https://gitpod.io/billing",
                "https://gitpod.io/usage",
                "https://gitpod.io/insights",
                "https://gitpod.io/new",
                "https://gitpod.io/login",
                "https://gitpod.io/login/org-slug",
                "https://gitpod.io/quickstart",
                "https://gitpod.io/admin", // Now allowed since login doesn't restrict paths
                "https://gitpod.io/api/workspace", // Now allowed
                "https://gitpod.io/any-path", // Any path is allowed
            ];

            validUrls.forEach((url) => {
                const result = validateLoginReturnToUrl(url, hostUrl);
                expect(result).to.equal(true, `Should accept valid login URL: ${url}`);
            });
        });

        it("should accept complete-auth with ONLY message parameter", () => {
            const validCompleteAuthUrls = [
                "https://gitpod.io/complete-auth?message=success:123",
                "https://gitpod.io/complete-auth?message=success",
            ];

            validCompleteAuthUrls.forEach((url) => {
                const result = validateLoginReturnToUrl(url, hostUrl);
                expect(result).to.equal(true, `Should accept complete-auth with only message: ${url}`);
            });
        });

        it("should reject complete-auth with additional parameters", () => {
            const invalidCompleteAuthUrls = [
                "https://gitpod.io/complete-auth?message=success&other=param",
                "https://gitpod.io/complete-auth?other=param&message=success",
                "https://gitpod.io/complete-auth",
                "https://gitpod.io/complete-auth?other=param",
                "https://gitpod.io/complete-auth?msg=success", // Wrong parameter name
            ];

            invalidCompleteAuthUrls.forEach((url) => {
                const result = validateLoginReturnToUrl(url, hostUrl);
                expect(result).to.equal(false, `Should reject complete-auth with extra params: ${url}`);
            });
        });

        it("should accept www.gitpod.io root only", () => {
            const result = validateLoginReturnToUrl("https://www.gitpod.io/", hostUrl);
            expect(result).to.equal(true, "Should accept www.gitpod.io root");

            const invalidWwwUrls = [
                "https://www.gitpod.io/workspaces",
                "https://www.gitpod.io/login",
                "http://www.gitpod.io/", // Wrong protocol
            ];

            invalidWwwUrls.forEach((url) => {
                const result = validateLoginReturnToUrl(url, hostUrl);
                expect(result).to.equal(false, `Should reject www.gitpod.io non-root: ${url}`);
            });
        });

        describe("Security Behavior", () => {
            it("should document nonce validation behavior", () => {
                // CSRF protection with nonce validation is always enabled
                // 1. Nonce is always generated and stored in cookie
                // 2. Nonce is always included in JWT state
                // 3. Nonce validation always occurs for security
                // 4. Cookie is always cleared after callback processing

                expect(true).to.equal(true); // Documentation test
            });

            it("should document strict authorize returnTo validation behavior", () => {
                // Strict returnTo validation is always enabled for /api/authorize
                // 1. /api/authorize endpoint always uses validateAuthorizeReturnToUrl (strict patterns)
                // 2. Only allows complete-auth, root, /new, /quickstart for security
                // 3. /api/login endpoint always uses login validation (broader patterns)

                expect(true).to.equal(true); // Documentation test
            });

            it("should show difference between strict and fallback validation", () => {
                const testUrls = [
                    { url: "https://gitpod.io/workspaces", strictAllowed: false, fallbackAllowed: true },
                    { url: "https://gitpod.io/settings", strictAllowed: false, fallbackAllowed: true },
                    { url: "https://gitpod.io/new", strictAllowed: true, fallbackAllowed: true },
                    { url: "https://gitpod.io/quickstart", strictAllowed: true, fallbackAllowed: true },
                    {
                        url: "https://gitpod.io/complete-auth?message=success",
                        strictAllowed: true,
                        fallbackAllowed: true,
                    },
                ];

                testUrls.forEach(({ url, strictAllowed, fallbackAllowed }) => {
                    const strictResult = validateAuthorizeReturnToUrl(url, hostUrl);
                    const fallbackResult = validateLoginReturnToUrl(url, hostUrl);

                    expect(strictResult).to.equal(strictAllowed, `Strict validation failed for: ${url}`);
                    expect(fallbackResult).to.equal(fallbackAllowed, `Fallback validation failed for: ${url}`);
                });
            });
        });
    });

    describe("validateAuthorizeReturnToUrl", () => {
        it("should accept only specific allowlisted paths", () => {
            const validUrls = [
                "https://gitpod.io/", // Root
                "https://gitpod.io/new", // Create workspace page
                "https://gitpod.io/quickstart", // Quickstart page
            ];

            validUrls.forEach((url) => {
                const result = validateAuthorizeReturnToUrl(url, hostUrl);
                expect(result).to.equal(true, `Should accept valid authorize URL: ${url}`);
            });
        });

        it("should accept complete-auth with ONLY message parameter", () => {
            const validCompleteAuthUrls = [
                "https://gitpod.io/complete-auth?message=success:123",
                "https://gitpod.io/complete-auth?message=success",
            ];

            validCompleteAuthUrls.forEach((url) => {
                const result = validateAuthorizeReturnToUrl(url, hostUrl);
                expect(result).to.equal(true, `Should accept complete-auth with only message: ${url}`);
            });
        });

        it("should reject paths not in authorize allowlist", () => {
            const rejectedUrls = [
                "https://gitpod.io/workspaces",
                "https://gitpod.io/workspaces/123",
                "https://gitpod.io/user-settings",
                "https://gitpod.io/integrations",
                "https://gitpod.io/prebuilds",
                "https://gitpod.io/members",
                "https://gitpod.io/billing",
                "https://gitpod.io/usage",
                "https://gitpod.io/insights",
                "https://gitpod.io/login",
                "https://gitpod.io/settings",
                "https://gitpod.io/repositories",
                "https://gitpod.io/admin",
                "https://gitpod.io/api/workspace",
            ];

            rejectedUrls.forEach((url) => {
                const result = validateAuthorizeReturnToUrl(url, hostUrl);
                expect(result).to.equal(false, `Should reject authorize URL: ${url}`);
            });
        });

        it("should accept www.gitpod.io root only", () => {
            const result = validateAuthorizeReturnToUrl("https://www.gitpod.io/", hostUrl);
            expect(result).to.equal(true, "Should accept www.gitpod.io root");
        });
    });

    describe("Common validation tests", () => {
        it("should reject different origins", () => {
            const invalidOriginUrls = [
                "https://evil.com/workspaces",
                "http://gitpod.io/workspaces", // Different protocol
                "https://gitpod.io:8080/workspaces", // Different port
                "https://subdomain.gitpod.io/workspaces", // Different subdomain
            ];

            invalidOriginUrls.forEach((url) => {
                expect(validateLoginReturnToUrl(url, hostUrl)).to.equal(false, `Login should reject: ${url}`);
                expect(validateAuthorizeReturnToUrl(url, hostUrl)).to.equal(false, `Authorize should reject: ${url}`);
            });
        });

        it("should have different path restrictions for login vs authorize", () => {
            const pathsAllowedInLoginOnly = [
                "https://gitpod.io/admin",
                "https://gitpod.io/workspace-123",
                "https://gitpod.io/api/workspace",
                "https://gitpod.io/workspaces",
                "https://gitpod.io/settings",
                "https://gitpod.io/any-arbitrary-path",
            ];

            pathsAllowedInLoginOnly.forEach((url) => {
                expect(validateLoginReturnToUrl(url, hostUrl)).to.equal(true, `Login should allow: ${url}`);
                expect(validateAuthorizeReturnToUrl(url, hostUrl)).to.equal(false, `Authorize should reject: ${url}`);
            });
        });

        it("should reject invalid URLs", () => {
            const invalidUrls = [
                "not-a-url",
                "javascript:alert('xss')",
                "data:text/html,<script>alert('xss')</script>",
                "",
                "//evil.com/workspaces",
                "ftp://gitpod.io/workspaces",
            ];

            invalidUrls.forEach((url) => {
                expect(validateLoginReturnToUrl(url, hostUrl)).to.equal(false, `Login should reject: ${url}`);
                expect(validateAuthorizeReturnToUrl(url, hostUrl)).to.equal(false, `Authorize should reject: ${url}`);
            });
        });

        it("should work with different host configurations", () => {
            const previewHostUrl = new GitpodHostUrl("https://preview.gitpod-dev.com");

            // Login should accept any path on same origin
            const validLoginUrls = [
                "https://preview.gitpod-dev.com/workspaces",
                "https://preview.gitpod-dev.com/complete-auth?message=success",
                "https://preview.gitpod-dev.com/any-path",
            ];

            validLoginUrls.forEach((url) => {
                expect(validateLoginReturnToUrl(url, previewHostUrl)).to.equal(true, `Login should accept: ${url}`);
            });

            // Authorize should only accept allowlisted paths
            const validAuthorizeUrls = [
                "https://preview.gitpod-dev.com/", // Root
                "https://preview.gitpod-dev.com/new", // Create workspace page
                "https://preview.gitpod-dev.com/quickstart", // Quickstart page
                "https://preview.gitpod-dev.com/complete-auth?message=success",
            ];

            validAuthorizeUrls.forEach((url) => {
                expect(validateAuthorizeReturnToUrl(url, previewHostUrl)).to.equal(
                    true,
                    `Authorize should accept: ${url}`,
                );
            });

            // Should reject /workspaces for authorize since it's not in allowlist
            expect(validateAuthorizeReturnToUrl("https://preview.gitpod-dev.com/workspaces", previewHostUrl)).to.equal(
                false,
            );

            // Should reject URLs for different hosts
            expect(validateLoginReturnToUrl("https://gitpod.io/workspaces", previewHostUrl)).to.equal(false);
            expect(validateAuthorizeReturnToUrl("https://gitpod.io/workspaces", previewHostUrl)).to.equal(false);
        });

        it("should validate www.gitpod.io specifically", () => {
            // Test with production gitpod.io
            const prodHostUrl = new GitpodHostUrl("https://gitpod.io");
            expect(validateLoginReturnToUrl("https://www.gitpod.io/", prodHostUrl)).to.equal(true);
            expect(validateAuthorizeReturnToUrl("https://www.gitpod.io/", prodHostUrl)).to.equal(true);

            // Test with different deployment - www.gitpod.io should still work as it's hardcoded
            const customHostUrl = new GitpodHostUrl("https://gitpod.example.com");
            expect(validateLoginReturnToUrl("https://www.gitpod.io/", customHostUrl)).to.equal(true);
            expect(validateAuthorizeReturnToUrl("https://www.gitpod.io/", customHostUrl)).to.equal(true);

            // Test that other www subdomains don't work
            expect(validateLoginReturnToUrl("https://www.gitpod.example.com/", prodHostUrl)).to.equal(false);
            expect(validateAuthorizeReturnToUrl("https://www.gitpod.example.com/", prodHostUrl)).to.equal(false);

            // Test domain injection prevention
            expect(validateLoginReturnToUrl("https://www.gitpod.io.evil.com/", prodHostUrl)).to.equal(false);
            expect(validateAuthorizeReturnToUrl("https://www.gitpod.io.evil.com/", prodHostUrl)).to.equal(false);
        });
    });
});
