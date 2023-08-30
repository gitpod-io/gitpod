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
    private client: Promise<Client> | undefined;

    constructor(
        private readonly clientConfig: SpiceDBClientConfig,
        private readonly interceptors: grpc.Interceptor[] = [],
    ) {}

    async getClient(): Promise<SpiceDBClient> {
        if (!this.client) {
            const client = this.newClient();
            this.client = Promise.resolve(client);
            return client.promises;
        }

        const client = await this.client;
        const state = client.getChannel().getConnectivityState(true);
        if (state === grpc.connectivityState.TRANSIENT_FAILURE || state === grpc.connectivityState.SHUTDOWN) {
            this.client = new Promise((resolve) => {
                client.waitForReady(10000, (err) => {
                    if (err) {
                        try {
                            client.close();
                        } catch (error) {
                            log.error("[spicedb] Failed to close client", error);
                        }

                        log.warn("[spicedb] Lost connection to SpiceDB - reconnecting...");
                        resolve(this.newClient());
                        return;
                    }
                    resolve(client);
                });
            });
        }
        return client.promises;
    }

    private newClient(): Client {
        // const options: grpc.ChannelOptions = {
        //     // // we ping frequently to check if the connection is still alive
        //     // "grpc.keepalive_time_ms": 1000,
        //     // "grpc.keepalive_timeout_ms": 1000,
        //     // "grpc.keepalive_permit_without_calls": 1,
        //     // // ...still, we don't want to overwhelm http2
        //     // "grpc.http2.min_time_between_pings_ms": 10000,
        //     // grpc-node sometimes crashes node if we don't set this option
        //     "grpc-node.max_session_memory": 50,
        //     "grpc.initial_reconnect_backoff_ms": 1000,
        //     "grpc.max_reconnect_backoff_ms": 5000,
        //     "grpc.dns_min_time_between_resolutions_ms": 5000, // default: 30000
        // };
        return v1.NewClient(
            this.clientConfig.token,
            this.clientConfig.address,
            v1.ClientSecurity.INSECURE_PLAINTEXT_CREDENTIALS,
            undefined, //
            {
                "grpc-node.max_session_memory": 50,
                "grpc.initial_reconnect_backoff_ms": 1000,
                "grpc.max_reconnect_backoff_ms": 5000,
                "grpc.dns_min_time_between_resolutions_ms": 5000, // default: 30000

                "grpc.service_config": JSON.stringify({
                    methodConfig: [
                        {
                            name: [{}],
                            retryPolicy: {
                                maxAttempts: 5,
                                initialBackoff: "0.1s",
                                maxBackoff: "1s",
                                backoffMultiplier: 2.0,
                                retryableStatusCodes: ["UNAVAILABLE"],
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
}
