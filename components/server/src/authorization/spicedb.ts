/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { v1 } from "@authzed/authzed-node";
import { IClientCallMetrics, createClientCallMetricsInterceptor } from "@gitpod/gitpod-protocol/lib/util/grpc";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import * as grpc from "@grpc/grpc-js";

export const SpiceDBClientProvider = Symbol("SpiceDBClientProvider");

export interface SpiceDBClientConfig {
    address: string;
    token: string;
}

export type SpiceDBClient = v1.ZedPromiseClientInterface;
type Client = v1.ZedClientInterface & grpc.Client;
export interface SpiceDBClientProvider {
    getClient(): SpiceDBClient;
}

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

function spicedbClientFromConfig(config: SpiceDBClientConfig): Client {
    const clientOptions: grpc.ClientOptions = {
        "grpc.client_idle_timeout_ms": 10000, // this ensures a connection is not stuck in the "READY" state for too long. Required for the reconnect logic below.
        "grpc.max_reconnect_backoff_ms": 5000, // default: 12000
    };

    return v1.NewClient(
        config.token,
        config.address,
        v1.ClientSecurity.INSECURE_PLAINTEXT_CREDENTIALS,
        undefined,
        clientOptions,
    ) as Client;
}

export class CachingSpiceDBClientProvider implements SpiceDBClientProvider {
    private client: Client | undefined;

    private readonly interceptors: grpc.Interceptor[] = [];

    constructor(
        private readonly _clientConfig: SpiceDBClientConfig,
        private readonly clientCallMetrics?: IClientCallMetrics | undefined,
    ) {
        if (this.clientCallMetrics) {
            this.interceptors.push(createClientCallMetricsInterceptor(this.clientCallMetrics));
        }
    }

    getClient(): SpiceDBClient {
        let client = this.client;
        if (!client) {
            client = spicedbClientFromConfig(this.clientConfig);
        } else if (client.getChannel().getConnectivityState(true) !== grpc.connectivityState.READY) {
            // (gpl): We need this check and explicit re-connect because we observe a ~120s connection timeout without it.
            // It's not entirely clear where that timeout comes from, but likely from the underlying transport, that is not exposed by grpc/grpc-js
            client.close();

            log.warn("[spicedb] Lost connection to SpiceDB - reconnecting...");

            client = spicedbClientFromConfig(this.clientConfig);
        }
        this.client = client;

        return client.promises;
    }

    protected get clientConfig() {
        const config = this._clientConfig;
        if (this.interceptors) {
            return {
                ...config,
                options: {
                    interceptors: [...this.interceptors],
                },
            };
        }
        return config;
    }
}
