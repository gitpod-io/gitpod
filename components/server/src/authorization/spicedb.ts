/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { v1 } from "@authzed/authzed-node";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import * as grpc from "@grpc/grpc-js";
import { getExperimentsClientForBackend } from "@gitpod/gitpod-protocol/lib/experiments/configcat-server";
import { TrustedValue } from "@gitpod/gitpod-protocol/lib/util/scrubbing";

export interface SpiceDBClientConfig {
    address: string;
    token: string;
}

export type SpiceDBClient = v1.ZedPromiseClientInterface;
type Client = v1.ZedClientInterface & grpc.Client;
const DEFAULT_FEATURE_FLAG_VALUE = "undefined";
const DefaultClientOptions: grpc.ClientOptions = {
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
};

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
    private client: Client | undefined = undefined;
    private previousClientOptionsString: string = DEFAULT_FEATURE_FLAG_VALUE;
    private clientOptions: grpc.ClientOptions;

    constructor(
        private readonly clientConfig: SpiceDBClientConfig,
        private readonly interceptors: grpc.Interceptor[] = [],
    ) {
        this.clientOptions = DefaultClientOptions;
        this.reconcileClientOptions();
    }

    private reconcileClientOptions(): void {
        const doReconcileClientOptions = async () => {
            const customClientOptions = await getExperimentsClientForBackend().getValueAsync(
                "spicedb_client_options",
                DEFAULT_FEATURE_FLAG_VALUE,
                {},
            );
            if (customClientOptions === this.previousClientOptionsString) {
                return;
            }
            let clientOptions = DefaultClientOptions;
            if (customClientOptions && customClientOptions != DEFAULT_FEATURE_FLAG_VALUE) {
                clientOptions = JSON.parse(customClientOptions);
            }
            if (this.client !== undefined) {
                const newClient = this.createClient(clientOptions);
                const oldClient = this.client;
                this.client = newClient;

                log.info("[spicedb] Client options changes", {
                    clientOptions: new TrustedValue(clientOptions),
                });

                // close client after 2 minutes to make sure most pending requests on the previous client are finished.
                setTimeout(() => {
                    this.closeClient(oldClient);
                }, 2 * 60 * 1000);
            }
            this.clientOptions = clientOptions;
            // `createClient` will use the `DefaultClientOptions` to create client if the value on Feature Flag is not able to create a client
            // but we will still write `previousClientOptionsString` here to prevent retry loops.
            this.previousClientOptionsString = customClientOptions;
        };
        // eslint-disable-next-line no-void
        void (async () => {
            while (true) {
                try {
                    await doReconcileClientOptions();
                    await new Promise((resolve) => setTimeout(resolve, 60 * 1000));
                } catch (e) {
                    log.error("[spicedb] Failed to reconcile client options", e);
                }
            }
        })();
    }

    private closeClient(client: Client) {
        try {
            client.close();
        } catch (error) {
            log.error("[spicedb] Error closing client", error);
        }
    }

    private createClient(clientOptions: grpc.ClientOptions): Client {
        log.debug("[spicedb] Creating client", {
            clientOptions: new TrustedValue(clientOptions),
        });
        try {
            return v1.NewClient(
                this.clientConfig.token,
                this.clientConfig.address,
                v1.ClientSecurity.INSECURE_PLAINTEXT_CREDENTIALS,
                undefined,
                {
                    ...clientOptions,
                    interceptors: this.interceptors,
                },
            ) as Client;
        } catch (error) {
            log.error("[spicedb] Error create client, fallback to default options", error);
            return v1.NewClient(
                this.clientConfig.token,
                this.clientConfig.address,
                v1.ClientSecurity.INSECURE_PLAINTEXT_CREDENTIALS,
                undefined,
                {
                    ...DefaultClientOptions,
                    interceptors: this.interceptors,
                },
            ) as Client;
        }
    }

    getClient(): SpiceDBClient {
        if (!this.client) {
            this.client = this.createClient(this.clientOptions);
        }
        return this.client.promises;
    }
}
