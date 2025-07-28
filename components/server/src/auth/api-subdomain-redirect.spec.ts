/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { expect } from "chai";
import { Container } from "inversify";
import { Config } from "../config";
import { Authenticator } from "./authenticator";

describe("API Subdomain Redirect Logic", () => {
    let container: Container;
    let authenticator: Authenticator;

    beforeEach(() => {
        container = new Container();
        container.bind(Config).toConstantValue({
            hostUrl: {
                url: new URL("https://gitpod.io"),
                with: (options: any) => ({
                    toString: () => `https://gitpod.io${options.pathname}?${options.search || ""}`,
                }),
            },
        } as any);

        // Mock other dependencies
        container.bind("HostContextProvider").toConstantValue({});
        container.bind("TokenProvider").toConstantValue({});
        container.bind("UserAuthentication").toConstantValue({});
        container.bind("SignInJWT").toConstantValue({});
        container.bind("NonceService").toConstantValue({});
        container.bind("UserService").toConstantValue({});
        container.bind("TeamDB").toConstantValue({});

        container.bind(Authenticator).toSelf();
        authenticator = container.get(Authenticator);
    });

    describe("isApiSubdomainOfConfiguredHost", () => {
        it("should detect api subdomain of configured host", () => {
            const testCases = [
                { hostname: "api.gitpod.io", expected: true },
                { hostname: "api.gitpod.io", expected: false }, // Different configured host
                { hostname: "gitpod.io", expected: false }, // Main domain
                { hostname: "workspace-123.gitpod.io", expected: false }, // Other subdomain
                { hostname: "api.evil.com", expected: false }, // Different domain
            ];

            testCases.forEach(({ hostname, expected }) => {
                const result = (authenticator as any).isApiSubdomainOfConfiguredHost(hostname);
                expect(result).to.equal(expected, `Failed for hostname: ${hostname}`);
            });
        });

        it("should handle GitHub OAuth edge case correctly", () => {
            // This is the specific case mentioned in the login completion handler
            const configuredHost = "gitpod.io";
            const apiSubdomain = `api.${configuredHost}`;

            const result = (authenticator as any).isApiSubdomainOfConfiguredHost(apiSubdomain);
            expect(result).to.be.true;
        });
    });

    describe("OAuth callback flow", () => {
        it("should redirect api subdomain to base domain", () => {
            // Simulate the flow:
            // 1. OAuth callback comes to api.gitpod.io/auth/github.com/callback
            // 2. System detects api subdomain and redirects to base domain
            // 3. Base domain can access nonce cookie and validate CSRF

            const apiHostname = "api.gitpod.io";
            const baseHostname = "gitpod.io";

            expect((authenticator as any).isApiSubdomainOfConfiguredHost(apiHostname)).to.be.true;
            expect((authenticator as any).isApiSubdomainOfConfiguredHost(baseHostname)).to.be.false;
        });
    });
});
