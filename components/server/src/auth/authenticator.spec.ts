/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import * as chai from "chai";
import { validateAuthorizeReturnToUrl } from "./authenticator";
import { Config } from "../config";
import { AuthProvider } from "./auth-provider";

const expect = chai.expect;

describe("authenticator", function () {
    describe("validateAuthorizeReturnToUrl", function () {
        const mockConfig = {
            hostUrl: {
                url: new URL("https://gitpod.io"),
            },
        } as Config;

        const mockAuthProvider = {} as AuthProvider;

        describe("valid URLs", function () {
            it("should return true for valid URLs from configured domain", function () {
                const result = validateAuthorizeReturnToUrl(
                    "https://gitpod.io/dashboard",
                    mockConfig,
                    mockAuthProvider,
                );
                expect(result).to.be.true;
            });

            it("should return true for valid URLs from www.gitpod.io", function () {
                const result = validateAuthorizeReturnToUrl(
                    "https://www.gitpod.io/pricing",
                    mockConfig,
                    mockAuthProvider,
                );
                expect(result).to.be.true;
            });

            it("should return false for URLs with subdomain that don't match prefix", function () {
                const result = validateAuthorizeReturnToUrl(
                    "https://app.gitpod.io/workspaces",
                    mockConfig,
                    mockAuthProvider,
                );
                expect(result).to.be.false;
            });
        });

        describe("invalid URLs - API paths", function () {
            it("should return false for URLs with /api path", function () {
                const result = validateAuthorizeReturnToUrl(
                    "https://gitpod.io/api/authorize",
                    mockConfig,
                    mockAuthProvider,
                );
                expect(result).to.be.false;
            });

            it("should return false for URLs with /api path", function () {
                const result = validateAuthorizeReturnToUrl(
                    "https://gitpod.io/api/users",
                    mockConfig,
                    mockAuthProvider,
                );
                expect(result).to.be.false;
            });

            it("should return false for URLs with /api/ path", function () {
                const result = validateAuthorizeReturnToUrl("https://gitpod.io/api/", mockConfig, mockAuthProvider);
                expect(result).to.be.false;
            });

            it("should return false for URLs with /API path (case insensitive)", function () {
                const result = validateAuthorizeReturnToUrl(
                    "https://gitpod.io/API/users",
                    mockConfig,
                    mockAuthProvider,
                );
                expect(result).to.be.false;
            });

            it("should return false for URLs with /api/callback path", function () {
                const result = validateAuthorizeReturnToUrl(
                    "https://gitpod.io/api/callback",
                    mockConfig,
                    mockAuthProvider,
                );
                expect(result).to.be.false;
            });

            it("should return false for URLs with api. subdomain", function () {
                const result = validateAuthorizeReturnToUrl(
                    "https://api.gitpod.io/users",
                    mockConfig,
                    mockAuthProvider,
                );
                expect(result).to.be.false;
            });

            it("should return false for URLs with API. subdomain (case insensitive)", function () {
                const result = validateAuthorizeReturnToUrl(
                    "https://API.gitpod.io/users",
                    mockConfig,
                    mockAuthProvider,
                );
                expect(result).to.be.false;
            });

            it("should return false for URLs with api. subdomain and /callback path", function () {
                const result = validateAuthorizeReturnToUrl(
                    "https://api.gitpod.io/callback",
                    mockConfig,
                    mockAuthProvider,
                );
                expect(result).to.be.false;
            });
        });

        describe("invalid URLs - external domains", function () {
            it("should return false for URLs from external domains", function () {
                const result = validateAuthorizeReturnToUrl("https://evil.com/dashboard", mockConfig, mockAuthProvider);
                expect(result).to.be.false;
            });

            it("should return false for URLs that look similar but are external", function () {
                const result = validateAuthorizeReturnToUrl(
                    "https://gitpod.io.evil.com/dashboard",
                    mockConfig,
                    mockAuthProvider,
                );
                expect(result).to.be.false;
            });
        });

        describe("malformed URLs", function () {
            it("should return false for malformed URLs", function () {
                const result = validateAuthorizeReturnToUrl("not-a-url", mockConfig, mockAuthProvider);
                expect(result).to.be.false;
            });

            it("should return false for URLs with invalid protocol", function () {
                const result = validateAuthorizeReturnToUrl("javascript:alert('xss')", mockConfig, mockAuthProvider);
                expect(result).to.be.false;
            });
        });

        describe("edge cases", function () {
            it("should return true for URLs with query parameters", function () {
                const result = validateAuthorizeReturnToUrl(
                    "https://gitpod.io/dashboard?tab=workspaces",
                    mockConfig,
                    mockAuthProvider,
                );
                expect(result).to.be.true;
            });

            it("should return true for URLs with fragments", function () {
                const result = validateAuthorizeReturnToUrl(
                    "https://gitpod.io/dashboard#workspaces",
                    mockConfig,
                    mockAuthProvider,
                );
                expect(result).to.be.true;
            });

            it("should return true for URLs with 'api' in query parameter but not in path", function () {
                const result = validateAuthorizeReturnToUrl(
                    "https://gitpod.io/dashboard?redirect=/api",
                    mockConfig,
                    mockAuthProvider,
                );
                expect(result).to.be.true;
            });

            it("should return true for URLs with 'api' in path but not starting with /api", function () {
                const result = validateAuthorizeReturnToUrl(
                    "https://gitpod.io/graphql-api",
                    mockConfig,
                    mockAuthProvider,
                );
                expect(result).to.be.true;
            });
        });
    });
});
