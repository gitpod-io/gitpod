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
        if (!this.client) {
            this.client = v1.NewClient(
                this.clientConfig.token,
                this.clientConfig.address,
                v1.ClientSecurity.INSECURE_PLAINTEXT_CREDENTIALS,
                undefined, //
                {
                    // we ping frequently to check if the connection is still alive
                    "grpc.keepalive_time_ms": 1000,
                    "grpc.keepalive_timeout_ms": 1000,

                    "grpc.max_reconnect_backoff_ms": 5000,
                    "grpc.initial_reconnect_backoff_ms": 500,
                    "grpc.service_config": JSON.stringify({
                        methodConfig: [
                            {
                                name: [{}],
                                retryPolicy: {
                                    maxAttempts: 10,
                                    initialBackoff: "0.1s",
                                    maxBackoff: "5s",
                                    backoffMultiplier: 2.0,
                                    retryableStatusCodes: ["UNAVAILABLE", "DEADLINE_EXCEEDED"],
                                },
                            },
                        ],
                    }),
                    "grpc.enable_retries": 1, //TODO enabled by default

                    // Governs how log DNS resolution results are cached (at minimum!)
                    // default is 30s, which is too long for us during rollouts (where service DNS entries are updated)
                    "grpc.dns_min_time_between_resolutions_ms": 2000,
                    interceptors: this.interceptors,
                },
            ) as Client;
        }
        return this.client.promises;
    }
}
