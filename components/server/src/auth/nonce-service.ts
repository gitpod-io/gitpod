/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { injectable, inject } from "inversify";
import express from "express";
import * as crypto from "crypto";
import { Config } from "../config";

const NONCE_COOKIE_NAME = "__Host-_gitpod_oauth_nonce_";
const NONCE_LENGTH = 32; // 32 bytes = 256 bits

@injectable()
export class NonceService {
    @inject(Config) protected readonly config: Config;

    /**
     * Generates a cryptographically secure random nonce
     */
    generateNonce(): string {
        return crypto.randomBytes(NONCE_LENGTH).toString("base64url");
    }

    /**
     * Sets the nonce cookie in the response
     */
    setNonceCookie(res: express.Response, nonce: string): void {
        res.cookie(NONCE_COOKIE_NAME, nonce, {
            httpOnly: true,
            secure: this.config.auth.session.cookie.secure,
            sameSite: "lax",
            maxAge: 5 * 60 * 1000, // 5 minutes (same as JWT state expiry)
            path: "/",
        });
    }

    /**
     * Gets the nonce from the request cookies
     */
    getNonceFromCookie(req: express.Request): string | undefined {
        return req.cookies?.[NONCE_COOKIE_NAME];
    }

    /**
     * Clears the nonce cookie
     */
    clearNonceCookie(res: express.Response): void {
        res.clearCookie(NONCE_COOKIE_NAME, {
            httpOnly: true,
            secure: this.config.auth.session.cookie.secure,
            sameSite: "lax",
            path: "/",
        });
    }

    /**
     * Validates that the nonce from the state matches the nonce from the cookie
     */
    validateNonce(stateNonce: string | undefined, cookieNonce: string | undefined): boolean {
        if (!stateNonce || !cookieNonce) {
            return false;
        }

        // Use crypto.timingSafeEqual to prevent timing attacks
        if (stateNonce.length !== cookieNonce.length) {
            return false;
        }

        const stateBuffer = Buffer.from(stateNonce, "base64url");
        const cookieBuffer = Buffer.from(cookieNonce, "base64url");

        if (stateBuffer.length !== cookieBuffer.length) {
            return false;
        }

        return crypto.timingSafeEqual(stateBuffer, cookieBuffer);
    }

    /**
     * Validates that the request origin is from the expected SCM provider domain
     */
    validateOrigin(req: express.Request, expectedHost: string): boolean {
        const origin = req.get("Origin");
        const referer = req.get("Referer");

        // For OAuth callbacks, we expect either Origin or Referer header
        const requestSource = origin || referer;

        if (!requestSource) {
            // No origin/referer header - this could be a direct navigation or CSRF attack
            return false;
        }

        try {
            const sourceUrl = new URL(requestSource);

            // Validate that the request comes from the expected SCM provider host
            // expectedHost could be "github.com", "gitlab.com", etc.
            const expectedOrigin = `https://${expectedHost}`;
            return sourceUrl.origin === expectedOrigin;
        } catch (error) {
            // Invalid URL format
            return false;
        }
    }
}
