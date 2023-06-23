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
import { getExperimentsClientForBackend } from "@gitpod/gitpod-protocol/lib/experiments/configcat-server";

export type CheckResult = {
    permitted: boolean;
    err?: Error;
    response?: v1.CheckPermissionResponse;
};

export const NotPermitted = { permitted: false };

export type ExperimentFields = {
    userID?: string;
    orgID?: string;
};

@injectable()
export class Authorizer {
    @inject(SpiceDBClient)
    private client: SpiceDBClient;

    async check(req: v1.CheckPermissionRequest, experimentsFields?: ExperimentFields): Promise<CheckResult> {
        if (!this.client) {
            return {
                permitted: false,
                err: new Error("Authorization client not available."),
                response: v1.CheckPermissionResponse.create({}),
            };
        }

        const featureEnabled = await getExperimentsClientForBackend().getValueAsync("centralizedPermissions", false, {
            user: { id: experimentsFields?.userID || "" },
            teamId: experimentsFields?.orgID,
        });
        if (!featureEnabled) {
            return {
                permitted: false,
                err: new Error("Feature flag not enabled."),
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

            throw new AuthorizerError("Failed to perform authorization check", err);
        }
    }

    async writeRelationships(
        req: v1.WriteRelationshipsRequest,
        experimentsFields?: ExperimentFields,
    ): Promise<v1.WriteRelationshipsResponse | undefined> {
        if (!this.client) {
            return undefined;
        }

        const featureEnabled = await getExperimentsClientForBackend().getValueAsync("centralizedPermissions", false, {
            user: { id: experimentsFields?.userID || "" },
            teamId: experimentsFields?.orgID,
        });
        if (!featureEnabled) {
            return undefined;
        }

        try {
            const response = await this.client.writeRelationships(req);
            log.info("[spicedb] Succesfully wrote relationships.", { response, request: req });

            return response;
        } catch (err) {
            log.error("[spicedb] Failed to write relationships.", err, { req });

            // While in we're running two authorization systems in parallel, we do not hard fail on writes.
            throw new AuthorizerError("Failed to write relationship", err);
        }
    }

    async deleteRelationships(
        req: v1.DeleteRelationshipsRequest,
        experimentsFields?: ExperimentFields,
    ): Promise<v1.DeleteRelationshipsResponse | undefined> {
        if (!this.client) {
            return undefined;
        }

        const featureEnabled = await getExperimentsClientForBackend().getValueAsync("centralizedPermissions", false, {
            user: { id: experimentsFields?.userID || "" },
            teamId: experimentsFields?.orgID,
        });
        if (!featureEnabled) {
            return undefined;
        }

        try {
            const response = await this.client.deleteRelationships(req);
            log.info("[spicedb] Succesfully deleted relationships.", { response, request: req });

            return response;
        } catch (err) {
            log.error("[spicedb] Failed to delete relationships.", err, { req });

            // While in we're running two authorization systems in parallel, we do not hard fail on writes.
            throw new AuthorizerError("Failed to delete relationships", err);
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

export class AuthorizerError extends Error {
    cause: Error;

    constructor(msg: string, cause: Error) {
        super(msg);
        this.cause = cause;

        // Set the prototype explicitly.
        Object.setPrototypeOf(this, AuthorizerError.prototype);
    }

    public static is(err: Error): err is AuthorizerError {
        return err instanceof AuthorizerError;
    }
}
