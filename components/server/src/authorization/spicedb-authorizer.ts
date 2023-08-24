/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { v1 } from "@authzed/authzed-node";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { TrustedValue } from "@gitpod/gitpod-protocol/lib/util/scrubbing";

import { getExperimentsClientForBackend } from "@gitpod/gitpod-protocol/lib/experiments/configcat-server";
import { inject, injectable } from "inversify";
import { observeSpicedbClientLatency, spicedbClientLatency } from "../prometheus-metrics";
import { SpiceDBClientProvider } from "./spicedb";
import * as grpc from "@grpc/grpc-js";

@injectable()
export class SpiceDBAuthorizer {
    constructor(
        @inject(SpiceDBClientProvider)
        private readonly clientProvider: SpiceDBClientProvider,
    ) {}

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
            const response = await this.client.checkPermission(req, this.callOptions);
            const permitted = response.permissionship === v1.CheckPermissionResponse_Permissionship.HAS_PERMISSION;

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

    async writeRelationships(...updates: v1.RelationshipUpdate[]): Promise<v1.WriteRelationshipsResponse | undefined> {
        const timer = spicedbClientLatency.startTimer();
        let error: Error | undefined;
        try {
            const response = await this.client.writeRelationships(
                v1.WriteRelationshipsRequest.create({
                    updates,
                }),
                this.callOptions,
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
            const existing = await this.client.readRelationships(
                v1.ReadRelationshipsRequest.create(req),
                this.callOptions,
            );
            if (existing.length > 0) {
                const response = await this.client.deleteRelationships(req, this.callOptions);
                const after = await this.client.readRelationships(
                    v1.ReadRelationshipsRequest.create(req),
                    this.callOptions,
                );
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
        return this.client.readRelationships(req, this.callOptions);
    }

    private get client() {
        return this.clientProvider.getClient();
    }

    /**
     * permission_service.grpc-client.d.ts has all methods overloaded with this pattern:
     *  - xyzRelationships(input: Request, metadata?: grpc.Metadata | grpc.CallOptions, options?: grpc.CallOptions): grpc.ClientReadableStream<ReadRelationshipsResponse>;
     * But the promisified client somehow does not have the same overloads. Thus we convince it here that options may be passed as 2nd argument.
     */
    private get callOptions(): grpc.Metadata {
        return (<grpc.CallOptions>{
            deadline: Date.now() + 8000,
        }) as any as grpc.Metadata;
    }
}
