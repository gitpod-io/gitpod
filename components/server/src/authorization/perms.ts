/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { v1 } from "@authzed/authzed-node";
import { ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { inject, injectable } from "inversify";
import { ResponseError } from "vscode-ws-jsonrpc";
import {
    observespicedbClientLatency as observeSpicedbClientLatency,
    spicedbClientLatency,
} from "../prometheus-metrics";
import { SpiceDBClient } from "./spicedb";

export type OrganizationOperation =
    // A not yet implemented operation at this time. This exists such that we can be explicit about what
    // we have not yet migrated to fine-grained-permissions.
    | "not_implemented"

    // Ability to perform write actions an Organization, and all sub-resources of the organization.
    | "org_write"

    // Ability to update Organization metadata - name, and other general info.
    | "org_metadata_write"
    // Ability to read Organization metadata - name, and other general info.
    | "org_metadata_read"

    // Ability to access information about team members.
    | "org_members_read"
    // Ability to add, or remove, team members.
    | "org_members_write"

    // Ability to read projects in an Organization.
    | "org_project_read"
    // Ability to create/update/delete projects in an Organization.
    | "org_project_write"

    // Ability to create/update/delete Organization Auth Providers.
    | "org_authprovider_write"
    // Ability to read Organization Auth Providers.
    | "org_authprovider_read";

export type ResourceType = "organization";

export type SubjectType = "user";

export type CheckResult = {
    permitted: boolean;
    err?: Error;
    response?: v1.CheckPermissionResponse;
};

export const NotPermitted = { permitted: false };

export const PermissionChecker = Symbol("PermissionChecker");

export interface PermissionChecker {
    check(req: v1.CheckPermissionRequest): Promise<CheckResult>;
}

@injectable()
export class Authorizer implements PermissionChecker {
    @inject(SpiceDBClient)
    private client: SpiceDBClient;

    async check(req: v1.CheckPermissionRequest): Promise<CheckResult> {
        if (!this.client) {
            return {
                permitted: false,
                err: new Error("Authorization client not available."),
                response: v1.CheckPermissionResponse.create({}),
            };
        }

        const timer = spicedbClientLatency.startTimer();
        try {
            const response = await this.client.checkPermission(req);
            const permitted = response.permissionship === v1.CheckPermissionResponse_Permissionship.HAS_PERMISSION;
            const err = !permitted ? newUnathorizedError(req.resource!, req.permission, req.subject!) : undefined;

            observeSpicedbClientLatency("check", req.permission, undefined, timer());

            return { permitted, response, err };
        } catch (err) {
            log.error("[spicedb] Failed to perform authorization check.", err, { req });
            observeSpicedbClientLatency("check", req.permission, err, timer());

            throw err;
        }
    }
}

function newUnathorizedError(resource: v1.ObjectReference, relation: string, subject: v1.SubjectReference) {
    return new ResponseError(
        ErrorCodes.PERMISSION_DENIED,
        `Subject (${objString(subject.object)}) is not permitted to perform ${relation} on resource ${objString(
            resource,
        )}.`,
    );
}

function objString(obj?: v1.ObjectReference): string {
    return `${obj?.objectType}:${obj?.objectId}`;
}
