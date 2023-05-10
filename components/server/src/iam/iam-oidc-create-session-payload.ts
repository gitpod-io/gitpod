/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { ResponseError } from "vscode-ws-jsonrpc";

export namespace OIDCCreateSessionPayload {
    export function validate(payload: any): OIDCCreateSessionPayload {
        if (typeof payload !== "object") {
            throw new ResponseError(ErrorCodes.BAD_REQUEST, "OIDC Create Session Payload is not an object.");
        }

        // validate payload.idToken
        if (!hasField(payload, "idToken")) {
            throw new ResponseError(
                ErrorCodes.BAD_REQUEST,
                "OIDC Create Session Payload does not contain idToken object.",
            );
        }

        // validate payload.claims
        if (!hasField(payload, "claims")) {
            throw new ResponseError(
                ErrorCodes.BAD_REQUEST,
                "OIDC Create Session Payload does not contain claims object.",
            );
        }
        if (hasEmptyField(payload.claims, "iss")) {
            throw new ResponseError(ErrorCodes.BAD_REQUEST, "Claim 'iss' (issuer) is missing");
        }
        if (hasEmptyField(payload.claims, "sub")) {
            throw new ResponseError(ErrorCodes.BAD_REQUEST, "Claim 'sub' (subject) is missing");
        }
        if (hasEmptyField(payload.claims, "name")) {
            throw new ResponseError(ErrorCodes.BAD_REQUEST, "Claim 'name' is missing");
        }
        if (hasEmptyField(payload.claims, "email")) {
            throw new ResponseError(ErrorCodes.BAD_REQUEST, "Claim 'email' is missing");
        }

        if (hasEmptyField(payload, "organizationId")) {
            throw new ResponseError(ErrorCodes.BAD_REQUEST, "OrganizationId is missing");
        }
        if (hasEmptyField(payload, "oidcClientConfigId")) {
            throw new ResponseError(ErrorCodes.BAD_REQUEST, "OIDC client config id missing");
        }

        return payload as OIDCCreateSessionPayload;
        // yloo
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
    organizationId: string; // TODO(gpl) Remove once we implemented either SKIM, or a proper UserService
    oidcClientConfigId: string;
}
