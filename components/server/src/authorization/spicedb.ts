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
import { IClientCallMetrics } from "@gitpod/gitpod-protocol/lib/util/grpc";
import { prometheusClientMiddleware } from "@gitpod/gitpod-protocol/lib/util/nice-grpc";
import { RetryOptions, retryMiddleware } from "nice-grpc-client-middleware-retry";
import { ConnectionOptions } from "tls";
import { DeadlineOptions, deadlineMiddleware } from "nice-grpc-client-middleware-deadline";

export interface SpiceDBClientConfig {
    address: string;
    token: string;
}

export type SpiceDBCallOptions = RetryOptions & DeadlineOptions;
export type SpiceDBClient = PermissionsServiceClient<SpiceDBCallOptions> & grpc.Client;

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
    private client: Promise<SpiceDBClient> | undefined;

    constructor(
        private readonly config: SpiceDBClientConfig,
        private readonly clientCallMetrics?: IClientCallMetrics,
    ) {}

    async getClient(): Promise<SpiceDBClient> {
        if (!this.client) {
            this.client = Promise.resolve(this.newClient());
            return this.client;
        }

        // const client = await this.client;
        // const state = client.getChannel().getConnectivityState(true);
        // if (state === grpc.connectivityState.TRANSIENT_FAILURE || state === grpc.connectivityState.SHUTDOWN) {
        //     this.client = new Promise((resolve) => {
        //         client.waitForReady(10000, (err) => {
        //             if (err) {
        //                 try {
        //                     client.close();
        //                 } catch (error) {
        //                     log.error("[spicedb] Failed to close client", error);
        //                 }

        //                 log.warn("[spicedb] Lost connection to SpiceDB - reconnecting...");
        //                 resolve(this.newClient());
        //                 return;
        //             }
        //             resolve(client);
        //         });
        //     });
        // }
        return this.client;
    }

    private newClient(): SpiceDBClient {
        const options: grpc.ChannelOptions = {
            // // we ping frequently to check if the connection is still alive
            // "grpc.keepalive_time_ms": 1000,
            // "grpc.keepalive_timeout_ms": 1000,
            // "grpc.keepalive_permit_without_calls": 1,
            // // ...still, we don't want to overwhelm http2
            // "grpc.http2.min_time_between_pings_ms": 10000,
            // grpc-node sometimes crashes node if we don't set this option
            "grpc-node.max_session_memory": 50,
            "grpc.initial_reconnect_backoff_ms": 1000,
            "grpc.max_reconnect_backoff_ms": 5000,
            "grpc.dns_min_time_between_resolutions_ms": 5000, // default: 30000
        };
        let factory = createClientFactory();
        if (this.clientCallMetrics) {
            factory = factory.use(prometheusClientMiddleware(this.clientCallMetrics));
        }

        const defaultCallOptions: SpiceDBCallOptions = {
            deadline: 20000, // give enough time for all retries to happen
            retryBaseDelayMs: 1000,
            retryMaxDelayMs: 5000,
            retryableStatuses: [grpc.status.UNAVAILABLE],
            retryMaxAttempts: 6,
        };
        const credentials = createClientCreds(this.config.token, ClientSecurity.INSECURE_PLAINTEXT_CREDENTIALS);
        const client = factory
            .use(retryMiddleware)
            .use(deadlineMiddleware)
            .create(PermissionsServiceDefinition, createChannel(this.config.address, credentials, options), {
                "*": {
                    ...defaultCallOptions,
                    // retry: Keep the default (based on protobuf definition of the RPC)
                },
                checkPermission: {
                    ...defaultCallOptions,
                    retry: true, // force override
                },
                readRelationships: {
                    ...defaultCallOptions,
                    retry: true, // force override
                },
                writeRelationships: {
                    ...defaultCallOptions,
                    retry: true, // force override
                },
            });
        return client as SpiceDBClient;
    }
}

// from @authzed/authzed-node/src/util.ts

export enum ClientSecurity {
    SECURE = 0,
    INSECURE_PLAINTEXT_CREDENTIALS = 2,
}

function createClientCreds(token: string, security: ClientSecurity): grpc.ChannelCredentials {
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
