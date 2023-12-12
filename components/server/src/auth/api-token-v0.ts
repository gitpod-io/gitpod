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
    user_code_sync: true,
    user_write_env_var: true,
    workspace_owner: true,
    organization_member: true,
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
    export function userCodeSync(userId: string): ApiTokenScope {
        return {
            permission: "user_code_sync",
            targetId: userId,
        };
    }
    export function userWriteEnvVar(userId: string): ApiTokenScope {
        return {
            permission: "user_write_env_var",
            targetId: userId,
        };
    }
    export function workspaceOwner(workspaceId: string): ApiTokenScope {
        return {
            permission: "workspace_owner",
            targetId: workspaceId,
        };
    }
    export function organizationMember(organizationId: string): ApiTokenScope {
        return {
            permission: "organization_member",
            targetId: organizationId,
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

export class ApiAccessTokenV0 {
    private static PREFIX = "gitpod_apitokenv0_";

    public constructor(
        readonly id: string,
        readonly scopes: ApiTokenScope[],
        /** This parameter is temporary, too ease the rollout of ApiTokens. Once we got rid of the websocket API (and all other impls that require a userId), we can get rid of it */
        readonly _userId?: string,
    ) {
        if (!!_userId && _userId !== id) {
            throw new Error("ApiTokenV0: Invalid userId");
        }
    }

    public static create(scopes: ApiTokenScope[], _userId?: string): ApiAccessTokenV0 {
        return new ApiAccessTokenV0(crypto.randomBytes(30).toString("hex"), scopes, _userId);
    }

    public static validatePrefix(token: string): boolean {
        return token.startsWith(ApiAccessTokenV0.PREFIX);
    }

    // TODO(gpl) we'd want to extract the dependency to authJWT out
    public static async parse(token: string, authJWT: AuthJWT): Promise<ApiAccessTokenV0> {
        if (!ApiAccessTokenV0.validatePrefix(token)) {
            throw new Error("Invalid API token prefix");
        }
        const jwtToken = token.substring(ApiAccessTokenV0.PREFIX.length);

        const payload = await authJWT.verify(jwtToken);
        log.debug("API token verified", { payload });

        if (!payload.sub) {
            throw new Error("Subject claim is missing in API token JWT");
        }
        const subjectAndUserId = payload.sub;

        // This is a way to carry the user ID in the subject claim. This is meant to be temporary for the rollout of API tokens, and when we make ctxUserId optional.
        const subjectParts = subjectAndUserId.split(":");
        const subjectId = SubjectId.tryParse(subjectParts[0]);

        // TODO Remove after rollout
        let _userId: string | undefined = undefined;
        if (subjectParts.length >= 2) {
            _userId = subjectParts[1];
        }

        const scopes = payload.scopes;
        if (!scopes || !Array.isArray(scopes)) {
            throw new Error("Scopes claim is missing or malformed in API token JWT");
        }
        return new ApiAccessTokenV0(subjectId.value, scopes as ApiTokenScope[], _userId);
    }

    public async encode(authJWT: AuthJWT): Promise<string> {
        const subjectIdStr = this.subjectId().toString();
        const sub = this._userId ? `${subjectIdStr}:${this._userId}` : subjectIdStr;
        const payload = {
            scopes: this.scopes,
        };
        const jwt = await authJWT.sign(sub, payload);
        return `${ApiAccessTokenV0.PREFIX}${jwt}`;
    }

    public subjectId(): SubjectId {
        return new SubjectId("apitokenv0", this.id, this._userId);
    }
}
