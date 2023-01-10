/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

export namespace OIDCCreateSessionPayload {
    export function is(payload: any): payload is OIDCCreateSessionPayload {
        return (
            typeof payload === "object" &&
            "idToken" in payload &&
            "claims" in payload &&
            "iss" in payload.claims &&
            "sub" in payload.claims &&
            "name" in payload.claims &&
            "email" in payload.claims
        );
    }

    export function validate(payload: OIDCCreateSessionPayload) {
        if (isEmpty(payload.claims.iss)) {
            throw new Error("Issuer is missing");
        }
        if (isEmpty(payload.claims.sub)) {
            throw new Error("Subject is missing");
        }
        if (isEmpty(payload.claims.name)) {
            throw new Error("Name is missing");
        }
        if (isEmpty(payload.claims.email)) {
            throw new Error("Email is missing");
        }
    }

    function isEmpty(attribute: any) {
        return typeof attribute !== "string" || attribute.length < 1;
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
    claims: {
        aud: string;
        email: string;
        email_verified: true;
        family_name: string;
        given_name: string;
        hd?: string; // accepted domain, e.g. "gitpod.io"
        iss: string; // "https://accounts.google.com"
        locale: string; // e.g. "de"
        name: string;
        picture: string; // URL of avatar
        sub: string; // "1234567890"
    };
}
