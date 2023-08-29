/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import {
    PermissionsServiceClient,
    PermissionsServiceDefinition,
} from "@gitpod/spicedb-api/lib/authzed/api/v1/permission_service.pb";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import * as grpc from "@grpc/grpc-js";
import { createChannel, createClientFactory } from "nice-grpc";
import { IClientCallMetrics, defaultGRPCOptions } from "@gitpod/gitpod-protocol/lib/util/grpc";
import { prometheusClientMiddleware } from "@gitpod/gitpod-protocol/lib/util/nice-grpc";
import { retryMiddleware } from "nice-grpc-client-middleware-retry";
import { ConnectionOptions } from "tls";

export interface SpiceDBClientConfig {
    address: string;
    token: string;
}

export type SpiceDBClient = Client;
// type Client = v1.ZedClientInterface & grpc.Client;
type Client = PermissionsServiceClient;

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
        private readonly config: SpiceDBClientConfig,
        private readonly clientCallMetrics?: IClientCallMetrics,
    ) {}

    getClient(): SpiceDBClient {
        if (!this.client) {
            const options: grpc.ClientOptions = {
                ...defaultGRPCOptions,
            };
            let factory = createClientFactory();
            if (this.clientCallMetrics) {
                factory = factory.use(prometheusClientMiddleware(this.clientCallMetrics));
            }
            const credentials = createClientCreds(this.config.token, ClientSecurity.INSECURE_PLAINTEXT_CREDENTIALS);
            this.client = factory
                .use(retryMiddleware)
                .create(PermissionsServiceDefinition, createChannel(this.config.address, credentials, options), {
                    "*": {
                        retryBaseDelayMs: 200,
                        retryMaxAttempts: 15,
                    },
                });
            // this.client = v1.NewClient(
            //     this.clientConfig.token,
            //     this.clientConfig.address,
            //     v1.ClientSecurity.INSECURE_PLAINTEXT_CREDENTIALS,
            //     undefined, //
            //     {
            //         callInvocationTransformer: (callProperties) => {
            //             callProperties.callOptions = {
            //                 ...callProperties.callOptions,
            //                 deadline: Date.now() + 8000,
            //             };
            //             return callProperties;
            //         },
            //         channelFactoryOverride: (address, credentials, _options) => {
            //             const options = {
            //                 ..._options,
            //                 "*": {
            //                     retryBaseDelayMs: 200,
            //                     retryMaxAttempts: 15,
            //                 },
            //             };
            //             return createChannel(address, credentials, options);
            //         },
            //         // wie ping frequently to check if the connection is still alive
            //         "grpc.keepalive_time_ms": 1000,
            //         "grpc.keepalive_timeout_ms": 1000,
            //         "grpc.dns_min_time_between_resolutions_ms": 5000, // default: 30000
            //         "grpc-node.max_session_memory": 50,
            //         "grpc.max_reconnect_backoff_ms": 5000,
            //         "grpc.initial_reconnect_backoff_ms": 500,
            //         // "grpc.service_config": JSON.stringify({
            //         //     methodConfig: [
            //         //         {
            //         //             name: [{}],
            //         //             deadline: {
            //         //                 seconds: 1,
            //         //                 nanos: 0,
            //         //             },
            //         //             retryPolicy: {
            //         //                 maxAttempts: 5,
            //         //                 initialBackoff: "0.1s",
            //         //                 maxBackoff: "1s",
            //         //                 backoffMultiplier: 2.0,
            //         //                 retryableStatusCodes: ["UNAVAILABLE", "DEADLINE_EXCEEDED"],
            //         //             },
            //         //         },
            //         //     ],
            //         // }),

            //         // "grpc.client_idle_timeout_ms": 10000, // this ensures a connection is not stuck in the "READY" state for too long. Required for the reconnect logic below.
            //         "grpc.enable_retries": 1, //TODO enabled by default
            //         interceptors: this.interceptors,
            //     },
            // ) as Client;
        }
        return this.client;
    }
}

// from @authzed/authzed-node/src/util.ts

export enum ClientSecurity {
    SECURE = 0,
    INSECURE_PLAINTEXT_CREDENTIALS = 2,
}

function createClientCreds(token: string, security: ClientSecurity = ClientSecurity.SECURE): grpc.ChannelCredentials {
    const metadata = new grpc.Metadata();
    metadata.set("authorization", "Bearer " + token);

    const creds = [];

    if (security === ClientSecurity.SECURE || security === ClientSecurity.INSECURE_PLAINTEXT_CREDENTIALS) {
        creds.push(
            grpc.credentials.createFromMetadataGenerator((_, callback) => {
                callback(null, metadata);
            }),
        );
    }

    return grpc.credentials.combineChannelCredentials(
        security === ClientSecurity.SECURE ? grpc.credentials.createSsl() : new KnownInsecureChannelCredentialsImpl(),
        ...creds,
    );
}

// Create our own known insecure channel creds.
// NOTE: Copied from channel-credentials.ts in gRPC Node package because its not exported:
// https://github.com/grpc/grpc-node/blob/3106057f5ad8f79a71d2ae411e116ad308a2e835/packages/grpc-js/src/call-credentials.ts#L143
class ComposedChannelCredentials extends grpc.ChannelCredentials {
    constructor(private channelCredentials: KnownInsecureChannelCredentialsImpl, callCreds: grpc.CallCredentials) {
        super(callCreds);
    }
    compose(callCredentials: grpc.CallCredentials) {
        const combinedCallCredentials = this.callCredentials.compose(callCredentials);
        return new ComposedChannelCredentials(this.channelCredentials, combinedCallCredentials);
    }

    _getConnectionOptions(): ConnectionOptions | null {
        return this.channelCredentials._getConnectionOptions();
    }
    _isSecure(): boolean {
        return false;
    }
    _equals(other: grpc.ChannelCredentials): boolean {
        if (this === other) {
            return true;
        }
        if (other instanceof ComposedChannelCredentials) {
            return (
                this.channelCredentials._equals(other.channelCredentials) &&
                this.callCredentials._equals(other.callCredentials)
            );
        } else {
            return false;
        }
    }
}

// See https://github.com/grpc/grpc-node/issues/543 for why this is necessary.
class KnownInsecureChannelCredentialsImpl extends grpc.ChannelCredentials {
    constructor(callCredentials?: grpc.CallCredentials) {
        super(callCredentials);
    }

    compose(callCredentials: grpc.CallCredentials): grpc.ChannelCredentials {
        const combinedCallCredentials = this.callCredentials.compose(callCredentials);
        return new ComposedChannelCredentials(this, combinedCallCredentials);
    }

    _getConnectionOptions(): ConnectionOptions | null {
        return null;
    }
    _isSecure(): boolean {
        return false;
    }
    _equals(other: grpc.ChannelCredentials): boolean {
        return other instanceof KnownInsecureChannelCredentialsImpl;
    }
}
