/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { expect } from "chai";
import { Container } from "inversify";
import { Config } from "../config";
import { NonceService } from "./nonce-service";

describe("NonceService", () => {
    let container: Container;
    let nonceService: NonceService;

    beforeEach(() => {
        container = new Container();
        container.bind(Config).toConstantValue({
            hostUrl: {
                url: new URL("https://gitpod.io"),
            },
            auth: {
                session: {
                    cookie: {
                        secure: true,
                    },
                },
            },
        } as any);
        container.bind(NonceService).toSelf();
        nonceService = container.get(NonceService);
    });

    describe("generateNonce", () => {
        it("should generate unique nonces", () => {
            const nonce1 = nonceService.generateNonce();
            const nonce2 = nonceService.generateNonce();

            expect(nonce1).to.be.a("string");
            expect(nonce2).to.be.a("string");
            expect(nonce1).to.not.equal(nonce2);
            expect(nonce1.length).to.be.greaterThan(40); // base64url encoded 32 bytes
        });
    });

    describe("validateNonce", () => {
        it("should validate matching nonces", () => {
            const nonce = nonceService.generateNonce();
            const isValid = nonceService.validateNonce(nonce, nonce);
            expect(isValid).to.be.true;
        });

        it("should reject different nonces", () => {
            const nonce1 = nonceService.generateNonce();
            const nonce2 = nonceService.generateNonce();
            const isValid = nonceService.validateNonce(nonce1, nonce2);
            expect(isValid).to.be.false;
        });

        it("should reject undefined nonces", () => {
            const nonce = nonceService.generateNonce();
            expect(nonceService.validateNonce(nonce, undefined)).to.be.false;
            expect(nonceService.validateNonce(undefined, nonce)).to.be.false;
            expect(nonceService.validateNonce(undefined, undefined)).to.be.false;
        });
    });

    describe("validateOrigin", () => {
        it("should accept requests from same origin", () => {
            const req = {
                get: (header: string) => {
                    if (header === "Origin") return "https://gitpod.io";
                    return undefined;
                },
            } as any;

            const isValid = nonceService.validateOrigin(req);
            expect(isValid).to.be.true;
        });

        it("should reject requests from different origin", () => {
            const req = {
                get: (header: string) => {
                    if (header === "Origin") return "https://evil.com";
                    return undefined;
                },
            } as any;

            const isValid = nonceService.validateOrigin(req);
            expect(isValid).to.be.false;
        });

        it("should reject requests without origin or referer", () => {
            const req = {
                get: () => undefined,
            } as any;

            const isValid = nonceService.validateOrigin(req);
            expect(isValid).to.be.false;
        });

        it("should accept requests with valid referer", () => {
            const req = {
                get: (header: string) => {
                    if (header === "Referer") return "https://gitpod.io/login";
                    return undefined;
                },
            } as any;

            const isValid = nonceService.validateOrigin(req);
            expect(isValid).to.be.true;
        });
    });
});
