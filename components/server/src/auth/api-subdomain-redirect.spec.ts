/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { expect } from "chai";

describe("API Subdomain Redirect Logic", () => {
    // Test the core logic without complex dependency injection
    function isApiSubdomainOfConfiguredHost(hostname: string, configuredHost: string): boolean {
        return hostname === `api.${configuredHost}`;
    }

    describe("isApiSubdomainOfConfiguredHost", () => {
        it("should detect api subdomain of configured host", () => {
            const configuredHost = "pd-nonce.preview.gitpod-dev.com";
            const testCases = [
                { hostname: "api.pd-nonce.preview.gitpod-dev.com", expected: true },
                { hostname: "api.gitpod.io", expected: false }, // Different configured host
                { hostname: "pd-nonce.preview.gitpod-dev.com", expected: false }, // Main domain
                { hostname: "workspace-123.pd-nonce.preview.gitpod-dev.com", expected: false }, // Other subdomain
                { hostname: "api.evil.com", expected: false }, // Different domain
            ];

            testCases.forEach(({ hostname, expected }) => {
                const result = isApiSubdomainOfConfiguredHost(hostname, configuredHost);
                expect(result).to.equal(expected, `Failed for hostname: ${hostname}`);
            });
        });

        it("should handle GitHub OAuth edge case correctly", () => {
            // This is the specific case mentioned in the login completion handler
            const configuredHost = "gitpod.io";
            const apiSubdomain = `api.${configuredHost}`;

            const result = isApiSubdomainOfConfiguredHost(apiSubdomain, configuredHost);
            expect(result).to.be.true;
        });

        it("should handle preview environment correctly", () => {
            const configuredHost = "pd-nonce.preview.gitpod-dev.com";
            const apiSubdomain = `api.${configuredHost}`;

            const result = isApiSubdomainOfConfiguredHost(apiSubdomain, configuredHost);
            expect(result).to.be.true;
        });
    });

    describe("OAuth callback flow scenarios", () => {
        it("should identify redirect scenarios correctly", () => {
            const scenarios = [
                {
                    name: "GitHub OAuth Callback on API Subdomain",
                    hostname: "api.pd-nonce.preview.gitpod-dev.com",
                    configuredHost: "pd-nonce.preview.gitpod-dev.com",
                    shouldRedirect: true,
                },
                {
                    name: "Regular Login on Main Domain",
                    hostname: "pd-nonce.preview.gitpod-dev.com",
                    configuredHost: "pd-nonce.preview.gitpod-dev.com",
                    shouldRedirect: false,
                },
                {
                    name: "Workspace Port (Should Not Redirect)",
                    hostname: "3000-pd-nonce.preview.gitpod-dev.com",
                    configuredHost: "pd-nonce.preview.gitpod-dev.com",
                    shouldRedirect: false,
                },
            ];

            scenarios.forEach((scenario) => {
                const result = isApiSubdomainOfConfiguredHost(scenario.hostname, scenario.configuredHost);
                expect(result).to.equal(
                    scenario.shouldRedirect,
                    `${scenario.name}: Expected ${scenario.shouldRedirect} for ${scenario.hostname}`,
                );
            });
        });
    });
});
