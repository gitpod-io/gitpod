/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import * as v1 from "@gitpod/spicedb-api/lib/authzed/api/v1/permission_service.pb";
import * as core_v1 from "@gitpod/spicedb-api/lib/authzed/api/v1/core.pb";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { TrustedValue } from "@gitpod/gitpod-protocol/lib/util/scrubbing";

import { getExperimentsClientForBackend } from "@gitpod/gitpod-protocol/lib/experiments/configcat-server";
import { inject, injectable } from "inversify";
import { observeSpicedbClientLatency, spicedbClientLatency } from "../prometheus-metrics";
import { SpiceDBClientProvider } from "./spicedb";

@injectable()
export class SpiceDBAuthorizer {
    constructor(
        @inject(SpiceDBClientProvider)
        private readonly clientProvider: SpiceDBClientProvider,
    ) {}

    private async client() {
        return this.clientProvider.getClient();
    }

    async check(
        req: v1.CheckPermissionRequest,
        experimentsFields: {
            userId: string;
        },
    ): Promise<boolean> {
        const featureEnabled = await getExperimentsClientForBackend().getValueAsync("centralizedPermissions", false, {
            user: {
                id: experimentsFields.userId,
            },
        });
        if (!featureEnabled) {
            return true;
        }

        const timer = spicedbClientLatency.startTimer();
        let error: Error | undefined;
        try {
            const client = await this.client();
            const response = await client.checkPermission(req);
            const permitted =
                response.permissionship === v1.CheckPermissionResponse_Permissionship.PERMISSIONSHIP_HAS_PERMISSION;

            return permitted;
        } catch (err) {
            error = err;
            log.error("[spicedb] Failed to perform authorization check.", err, {
                request: new TrustedValue(req),
            });
            return false;
        } finally {
            observeSpicedbClientLatency("check", error, timer());
        }
    }

    async writeRelationships(
        ...updates: core_v1.RelationshipUpdate[]
    ): Promise<v1.WriteRelationshipsResponse | undefined> {
        const timer = spicedbClientLatency.startTimer();
        let error: Error | undefined;
        try {
            const client = await this.client();
            const response = await client.writeRelationships(
                v1.WriteRelationshipsRequest.fromPartial({
                    updates,
                }),
            );
            log.info("[spicedb] Successfully wrote relationships.", { response, updates });

            return response;
        } catch (err) {
            error = err;
            log.error("[spicedb] Failed to write relationships.", err, { updates: new TrustedValue(updates) });
        } finally {
            observeSpicedbClientLatency("write", error, timer());
        }
    }

    async deleteRelationships(req: v1.DeleteRelationshipsRequest): Promise<v1.ReadRelationshipsResponse[]> {
        const timer = spicedbClientLatency.startTimer();
        let error: Error | undefined;
        try {
            const client = await this.client();
            const existing = await toArray(client.readRelationships(v1.ReadRelationshipsRequest.fromPartial(req)));
            if (existing.length > 0) {
                const response = await client.deleteRelationships(req);
                const after = await toArray(client.readRelationships(v1.ReadRelationshipsRequest.fromPartial(req)));
                if (after.length > 0) {
                    log.error("[spicedb] Failed to delete relationships.", { existing, after, request: req });
                }
                log.info(`[spicedb] Successfully deleted ${existing.length} relationships.`, {
                    response,
                    request: req,
                    existing,
                });
            }
            return existing;
        } catch (err) {
            error = err;
            // While in we're running two authorization systems in parallel, we do not hard fail on writes.
            //TODO throw new ApplicationError(ErrorCodes.INTERNAL_SERVER_ERROR, "Failed to delete relationships.");
            log.error("[spicedb] Failed to delete relationships.", err, { request: new TrustedValue(req) });
            return [];
        } finally {
            observeSpicedbClientLatency("delete", error, timer());
        }
    }

    async readRelationships(req: v1.ReadRelationshipsRequest): Promise<v1.ReadRelationshipsResponse[]> {
        const client = await this.client();
        return toArray(client.readRelationships(req));
    }
}
async function toArray<T>(it: AsyncIterable<T>): Promise<T[]> {
    const arr: T[] = [];
    for await (const i of it) arr.push(i);
    return arr;
}
