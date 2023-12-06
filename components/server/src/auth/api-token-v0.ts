/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import * as crypto from "crypto";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { AuthJWT } from "./jwt";
import { SubjectId } from "./subject-id";

export type ApiTokenScope = {
    permission: ApiTokenScopePermission;
    targetId: string;
};
export type ApiTokenScopePermission = keyof typeof ApiTokenScopePermissions;
const ApiTokenScopePermissions = {
    user_read: true,
    user_write: true,
    workspace: true,
};
export namespace ApiTokenScope {
    const PERMISSION_SEPARATOR = ":";
    const SCOPE_SEPARATOR = ",";
    export function userRead(userId: string): ApiTokenScope {
        return {
            permission: "user_read",
            targetId: userId,
        };
    }
    export function userWrite(userId: string): ApiTokenScope {
        return {
            permission: "user_write",
            targetId: userId,
        };
    }
    export function workspaceOwner(workspaceId: string): ApiTokenScope {
        return {
            permission: "workspace",
            targetId: workspaceId,
        };
    }
    export function decode(encoded: string): ApiTokenScope {
        const parts = encoded.split(PERMISSION_SEPARATOR);
        if (parts.length !== 2) {
            throw new Error("Unexpected number of parts in API scope");
        }
        const [permission, targetId] = parts;
        if (!ApiTokenScopePermissions[permission as ApiTokenScopePermission]) {
            throw new Error(`Invalid API scope permission ${permission}`);
        }
        return {
            permission: permission as ApiTokenScopePermission,
            targetId,
        };
    }
    export function encode(...scope: ApiTokenScope[]): string {
        return scope.map((s) => `${s.permission}${PERMISSION_SEPARATOR}${s.targetId}`).join(SCOPE_SEPARATOR);
    }
}

export class ApiAccessToken {
    private static PREFIX = "gitpod_apitokenv0_";

    public constructor(readonly id: string, readonly scopes: ApiTokenScope[]) {}

    public static create(scopes: ApiTokenScope[]): ApiAccessToken {
        return new ApiAccessToken(crypto.randomBytes(30).toString("hex"), scopes);
    }

    public static validatePrefix(token: string): boolean {
        return token.startsWith(ApiAccessToken.PREFIX);
    }

    // TODO(gpl) we'd want to extract the dependency to authJWT out
    public static async parse(token: string, authJWT: AuthJWT): Promise<ApiAccessToken> {
        if (!ApiAccessToken.validatePrefix(token)) {
            throw new Error("Invalid API token prefix");
        }
        const jwtToken = token.substring(ApiAccessToken.PREFIX.length);

        const payload = await authJWT.verify(jwtToken);
        log.debug("API token verified", { payload });

        if (!payload.sub) {
            throw new Error("Subject claim is missing in API token JWT");
        }
        const subjectId = SubjectId.tryParse(payload.sub);

        const scopes = payload.scopes;
        if (!scopes || !Array.isArray(scopes)) {
            throw new Error("Scopes claim is missing or malformed in API token JWT");
        }
        return new ApiAccessToken(subjectId.value, scopes as ApiTokenScope[]);
    }

    public async encode(authJWT: AuthJWT): Promise<string> {
        const subjectIdStr = this.subjectId.toString();
        const payload = {
            sub: subjectIdStr,
            scopes: this.scopes,
        };
        const jwt = await authJWT.sign(subjectIdStr, payload);
        return `${ApiAccessToken.PREFIX}${jwt}`;
    }

    public subjectId(): SubjectId {
        return new SubjectId("apitokenv0", this.id);
    }
}
