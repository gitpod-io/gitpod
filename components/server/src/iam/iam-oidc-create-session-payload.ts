/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { ErrorCodes, ApplicationError } from "@gitpod/gitpod-protocol/lib/messaging/error";

export namespace OIDCCreateSessionPayload {
    export function validate(payload: any): OIDCCreateSessionPayload {
        if (typeof payload !== "object") {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "OIDC Create Session Payload is not an object.");
        }

        // validate payload.idToken
        if (!hasField(payload, "idToken")) {
            throw new ApplicationError(
                ErrorCodes.BAD_REQUEST,
                "OIDC Create Session Payload does not contain idToken object.",
            );
        }

        // validate payload.claims
        if (!hasField(payload, "claims")) {
            throw new ApplicationError(
                ErrorCodes.BAD_REQUEST,
                "OIDC Create Session Payload does not contain claims object.",
            );
        }
        if (hasEmptyField(payload.claims, "iss")) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "Claim 'iss' (issuer) is missing");
        }
        if (hasEmptyField(payload.claims, "sub")) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "Claim 'sub' (subject) is missing");
        }
        if (hasEmptyField(payload.claims, "name")) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "Claim 'name' is missing");
        }
        if (hasEmptyField(payload.claims, "email")) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "Claim 'email' is missing");
        }

        if (hasEmptyField(payload, "organizationId")) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "OrganizationId is missing");
        }
        if (hasEmptyField(payload, "oidcClientConfigId")) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "OIDC client config id missing");
        }

        return payload as OIDCCreateSessionPayload;
    }

    function isEmpty(attribute: any): boolean {
        return typeof attribute !== "string" || attribute.trim().length < 1;
    }

    function hasField(obj: any, key: string): boolean {
        return typeof obj === "object" && key in obj;
    }

    function hasEmptyField(obj: any, key: string): boolean {
        return hasField(obj, key) && isEmpty(obj[key]);
    }
}

export interface OIDCCreateSessionPayload {
    idToken: {
        Issuer: string; // "https://accounts.google.com",
        Audience: string[];
        Subject: string; // "1234567890",
        Expiry: string; // "2023-01-10T12:00:00Z",
        IssuedAt: string; // "2023-01-01T12:00:00Z",
    };
    /**
     * https://openid.net/specs/openid-connect-core-1_0.html#StandardClaims
     */
    claims: {
        aud: string;
        email: string;
        email_verified: true;
        family_name: string;
        given_name: string;
        hd?: string; // accepted domain, e.g. "gitpod.io"
        iss: string; // "https://accounts.google.com"
        locale: string; // e.g. "de"
        /**
         * End-User's full name in displayable form including all name parts, possibly including titles and suffixes, ordered according to the End-User's locale and preferences.
         */
        name: string;
        picture: string; // URL of avatar
        /**
         * Subject - Identifier for the End-User at the Issuer.
         */
        sub: string; // "1234567890"
    };
    organizationId: string;
    oidcClientConfigId: string;
}
