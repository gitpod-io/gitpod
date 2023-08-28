/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { v1 } from "@authzed/authzed-node";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import * as grpc from "@grpc/grpc-js";

export interface SpiceDBClientConfig {
    address: string;
    token: string;
}

export type SpiceDBClient = v1.ZedPromiseClientInterface;
type Client = v1.ZedClientInterface & grpc.Client;

export function spiceDBConfigFromEnv(): SpiceDBClientConfig | undefined {
    const token = process.env["SPICEDB_PRESHARED_KEY"];
    if (!token) {
        log.error("[spicedb] No preshared key configured.");
        return undefined;
    }

    const address = process.env["SPICEDB_ADDRESS"];
    if (!address) {
        log.error("[spicedb] No service address configured.");
        return undefined;
    }
    return {
        address,
        token,
    };
}

export class SpiceDBClientProvider {
    private client: Client | undefined;

    constructor(
        private readonly clientConfig: SpiceDBClientConfig,
        private readonly interceptors: grpc.Interceptor[] = [],
    ) {}

    getClient(): SpiceDBClient {
        if (this.client) {
            const state = this.client.getChannel().getConnectivityState(true);
            if (state === grpc.connectivityState.TRANSIENT_FAILURE || state === grpc.connectivityState.SHUTDOWN) {
                log.warn("[spicedb] Lost connection to SpiceDB - reconnecting...");
                try {
                    this.client.close();
                } catch (error) {
                    log.error("[spicedb] Failed to close client", error);
                } finally {
                    this.client = undefined;
                }
            }
        }

        if (!this.client) {
            this.client = v1.NewClient(
                this.clientConfig.token,
                this.clientConfig.address,
                v1.ClientSecurity.INSECURE_PLAINTEXT_CREDENTIALS,
                undefined, //
                {
                    // wie ping frequently to check if the connection is still alive
                    "grpc.keepalive_time_ms": 1000,
                    "grpc.keepalive_timeout_ms": 1000,

                    "grpc.max_reconnect_backoff_ms": 5000,
                    "grpc.initial_reconnect_backoff_ms": 500,
                    "grpc.service_config": JSON.stringify({
                        methodConfig: [
                            {
                                name: [{}],
                                deadline: {
                                    seconds: 1,
                                    nanos: 0,
                                },
                                retryPolicy: {
                                    maxAttempts: 5,
                                    initialBackoff: "0.1s",
                                    maxBackoff: "1s",
                                    backoffMultiplier: 2.0,
                                    retryableStatusCodes: ["UNAVAILABLE", "DEADLINE_EXCEEDED"],
                                },
                            },
                        ],
                    }),

                    // "grpc.client_idle_timeout_ms": 10000, // this ensures a connection is not stuck in the "READY" state for too long. Required for the reconnect logic below.
                    "grpc.enable_retries": 1, //TODO enabled by default
                    interceptors: this.interceptors,
                },
            ) as Client;
        }
        return this.client.promises;
    }
}
