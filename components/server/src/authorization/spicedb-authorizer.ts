/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { v1 } from "@authzed/authzed-node";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { TrustedValue } from "@gitpod/gitpod-protocol/lib/util/scrubbing";

import { inject, injectable } from "inversify";
import { observeSpicedbClientLatency, spicedbClientLatency } from "../prometheus-metrics";
import { SpiceDBClientProvider } from "./spicedb";
import * as grpc from "@grpc/grpc-js";
import { isFgaChecksEnabled, isFgaWritesEnabled } from "./authorizer";

async function tryThree<T>(errMessage: string, code: (attempt: number) => Promise<T>): Promise<T> {
    let attempt = 0;
    // we do sometimes see INTERNAL errors from SpiceDB, so we retry a few times
    // last time we checked it was 15 times per day (check logs)
    while (attempt++ < 3) {
        try {
            return await code(attempt);
        } catch (err) {
            if (err.code === grpc.status.INTERNAL && attempt < 3) {
                log.warn(errMessage, err, {
                    attempt,
                });
            } else {
                log.error(errMessage, err, {
                    attempt,
                });
                // we don't try again on other errors
                throw err;
            }
        }
    }
    throw new Error("unreachable");
}

export const SpiceDBAuthorizer = Symbol("SpiceDBAuthorizer");
export interface SpiceDBAuthorizer {
    check(
        req: v1.CheckPermissionRequest,
        experimentsFields: {
            userId: string;
        },
        forceEnablement?: boolean,
    ): Promise<CheckResult>;
    writeRelationships(...updates: v1.RelationshipUpdate[]): Promise<v1.WriteRelationshipsResponse | undefined>;
    deleteRelationships(req: v1.DeleteRelationshipsRequest): Promise<DeletionResult>;
    readRelationships(req: v1.ReadRelationshipsRequest): Promise<v1.ReadRelationshipsResponse[]>;
}

export interface CheckResult {
    permitted: boolean;
    checkedAt?: string;
}

export interface DeletionResult {
    relationships: v1.ReadRelationshipsResponse[];
    deletedAt?: string;
}

@injectable()
export class SpiceDBAuthorizerImpl implements SpiceDBAuthorizer {
    constructor(
        @inject(SpiceDBClientProvider)
        private readonly clientProvider: SpiceDBClientProvider,
    ) {}

    private get client(): v1.ZedPromiseClientInterface {
        return this.clientProvider.getClient();
    }

    async check(
        req: v1.CheckPermissionRequest,
        experimentsFields: {
            userId: string;
        },
        forceEnablement?: boolean,
    ): Promise<CheckResult> {
        if (!(await isFgaWritesEnabled(experimentsFields.userId))) {
            return { permitted: true };
        }
        const featureEnabled = !!forceEnablement || (await isFgaChecksEnabled(experimentsFields.userId));
        const result = (async () => {
            const timer = spicedbClientLatency.startTimer();
            let error: Error | undefined;
            try {
                const response = await tryThree("[spicedb] Failed to perform authorization check.", () =>
                    this.client.checkPermission(req, this.callOptions),
                );
                const permitted = response.permissionship === v1.CheckPermissionResponse_Permissionship.HAS_PERMISSION;
                if (!permitted && !featureEnabled) {
                    log.info("[spicedb] Permission denied.", {
                        response: new TrustedValue(response),
                        request: new TrustedValue(req),
                    });
                    return { permitted: true, checkedAt: response.checkedAt?.token };
                }

                return { permitted, checkedAt: response.checkedAt?.token };
            } catch (err) {
                error = err;
                log.error("[spicedb] Failed to perform authorization check.", err, {
                    request: new TrustedValue(req),
                });
                return { permitted: !featureEnabled };
            } finally {
                observeSpicedbClientLatency("check", error, timer());
            }
        })();
        // if the feature is not enabld, we don't await
        if (!featureEnabled) {
            return { permitted: true };
        }
        return result;
    }

    async writeRelationships(...updates: v1.RelationshipUpdate[]): Promise<v1.WriteRelationshipsResponse | undefined> {
        const timer = spicedbClientLatency.startTimer();
        let error: Error | undefined;
        try {
            const response = await tryThree("[spicedb] Failed to write relationships.", () =>
                this.client.writeRelationships(
                    v1.WriteRelationshipsRequest.create({
                        updates,
                    }),
                    this.callOptions,
                ),
            );
            log.info("[spicedb] Successfully wrote relationships.", { response, updates });

            return response;
        } finally {
            observeSpicedbClientLatency("write", error, timer());
        }
    }

    async deleteRelationships(req: v1.DeleteRelationshipsRequest): Promise<DeletionResult> {
        const timer = spicedbClientLatency.startTimer();
        let error: Error | undefined;
        try {
            let deletedAt: string | undefined = undefined;
            const existing = await tryThree("readRelationships before deleteRelationships failed.", () =>
                this.client.readRelationships(v1.ReadRelationshipsRequest.create(req), this.callOptions),
            );
            if (existing.length > 0) {
                const response = await tryThree("deleteRelationships failed.", () =>
                    this.client.deleteRelationships(req, this.callOptions),
                );
                deletedAt = response.deletedAt?.token;
                const after = await tryThree("readRelationships failed.", () =>
                    this.client.readRelationships(v1.ReadRelationshipsRequest.create(req), this.callOptions),
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
            return {
                relationships: existing,
                deletedAt,
            };
        } catch (err) {
            error = err;
            // While in we're running two authorization systems in parallel, we do not hard fail on writes.
            //TODO throw new ApplicationError(ErrorCodes.INTERNAL_SERVER_ERROR, "Failed to delete relationships.");
            log.error("[spicedb] Failed to delete relationships.", err, { request: new TrustedValue(req) });
            return { relationships: [] };
        } finally {
            observeSpicedbClientLatency("delete", error, timer());
        }
    }

    async readRelationships(req: v1.ReadRelationshipsRequest): Promise<v1.ReadRelationshipsResponse[]> {
        return tryThree("readRelationships failed.", () => this.client.readRelationships(req, this.callOptions));
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
