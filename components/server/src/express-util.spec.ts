/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import * as chai from "chai";
import { isAllowedWebsocketDomain, getReturnToParamWithSafeBaseDomain } from "./express-util";
const expect = chai.expect;

describe("express-util", function () {
    describe("isAllowedWebsocketDomain for dev-staging", function () {
        const HOSTURL_HOSTNAME = "gpl-2732-ws-csrf.staging.gitpod.io";
        it("should return false for workspace-port locations", function () {
            const result = isAllowedWebsocketDomain(
                "http://3000-moccasin-ferret-155799b3.ws-eu.gpl-2732-ws-csrf.staging.gitpod.io",
                HOSTURL_HOSTNAME,
            );
            expect(result).to.be.false;
        });

        it("should return true for workspace locations", function () {
            const result = isAllowedWebsocketDomain(
                "http://moccasin-ferret-155799b3.ws-eu.gpl-2732-ws-csrf.staging.gitpod.io",
                HOSTURL_HOSTNAME,
            );
            expect(result).to.be.false;
        });

        it("should return true for dashboard", function () {
            const result = isAllowedWebsocketDomain("http://gpl-2732-ws-csrf.staging.gitpod.io", HOSTURL_HOSTNAME);
            expect(result).to.be.true;
        });
    });
    describe("isAllowedWebsocketDomain for gitpod.io", function () {
        const HOSTURL_HOSTNAME = "gitpod.io";
        it("should return false for workspace-port locations", function () {
            const result = isAllowedWebsocketDomain(
                "https://8000-black-capybara-dy6e3fgz.ws-eu08.gitpod.io",
                HOSTURL_HOSTNAME,
            );
            expect(result).to.be.false;
        });

        it("should return true for workspace locations", function () {
            const result = isAllowedWebsocketDomain("https://bronze-bird-p2q226d8.ws-eu08.gitpod.io", HOSTURL_HOSTNAME);
            expect(result).to.be.false;
        });
    });

    describe("getReturnToParamWithSafeBaseDomain", function () {
        const configuredBaseDomain = new URL("https://gitpod.io");

        describe("valid URLs", function () {
            it("should allow URLs from configured base domain", function () {
                const result = getReturnToParamWithSafeBaseDomain("https://gitpod.io/dashboard", configuredBaseDomain);
                expect(result).to.equal("https://gitpod.io/dashboard");
            });

            it("should allow URLs from www.gitpod.io", function () {
                const result = getReturnToParamWithSafeBaseDomain(
                    "https://www.gitpod.io/pricing",
                    configuredBaseDomain,
                );
                expect(result).to.equal("https://www.gitpod.io/pricing");
            });

            it("should reject URLs with subdomain that don't match prefix", function () {
                const result = getReturnToParamWithSafeBaseDomain(
                    "https://app.gitpod.io/workspaces",
                    configuredBaseDomain,
                );
                expect(result).to.be.undefined;
            });

            it("should handle undefined returnToURL", function () {
                const result = getReturnToParamWithSafeBaseDomain(undefined, configuredBaseDomain);
                expect(result).to.be.undefined;
            });

            it("should handle empty returnToURL", function () {
                const result = getReturnToParamWithSafeBaseDomain("", configuredBaseDomain);
                expect(result).to.be.undefined;
            });
        });

        describe("invalid URLs - external domains", function () {
            it("should reject URLs from external domains", function () {
                const result = getReturnToParamWithSafeBaseDomain("https://evil.com/dashboard", configuredBaseDomain);
                expect(result).to.be.undefined;
            });

            it("should reject URLs that look similar but are external", function () {
                const result = getReturnToParamWithSafeBaseDomain(
                    "https://gitpod.io.evil.com/dashboard",
                    configuredBaseDomain,
                );
                expect(result).to.be.undefined;
            });
        });

        describe("edge cases", function () {
            it("should allow URLs with query parameters", function () {
                const result = getReturnToParamWithSafeBaseDomain(
                    "https://gitpod.io/dashboard?tab=workspaces",
                    configuredBaseDomain,
                );
                expect(result).to.equal("https://gitpod.io/dashboard?tab=workspaces");
            });

            it("should allow URLs with fragments", function () {
                const result = getReturnToParamWithSafeBaseDomain(
                    "https://gitpod.io/dashboard#workspaces",
                    configuredBaseDomain,
                );
                expect(result).to.equal("https://gitpod.io/dashboard#workspaces");
            });

            it("should allow URLs with 'api' in path but not starting with /api", function () {
                const result = getReturnToParamWithSafeBaseDomain(
                    "https://gitpod.io/graphql-api",
                    configuredBaseDomain,
                );
                expect(result).to.equal("https://gitpod.io/graphql-api");
            });
        });
    });
});
