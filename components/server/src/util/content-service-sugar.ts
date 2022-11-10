/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { inject, injectable, interfaces, optional } from "inversify";
import * as grpc from "@grpc/grpc-js";
import { createClientCallMetricsInterceptor, IClientCallMetrics } from "@gitpod/gitpod-protocol/lib/util/grpc";
import { IDEPluginServiceClient } from "@gitpod/content-service/lib/ideplugin_grpc_pb";
import { ContentServiceClient } from "@gitpod/content-service/lib/content_grpc_pb";
import { BlobServiceClient } from "@gitpod/content-service/lib/blobs_grpc_pb";
import { WorkspaceServiceClient } from "@gitpod/content-service/lib/workspace_grpc_pb";
import { HeadlessLogServiceClient } from "@gitpod/content-service/lib/headless-log_grpc_pb";

export const ContentServiceClientConfig = Symbol("ContentServiceClientConfig");
export const ContentServiceClientCallMetrics = Symbol("ContentServiceClientCallMetrics");

export const contentServiceBinder = (
    config: (ctx: interfaces.Context) => ContentServiceClientConfig,
    clientCallMetrics?: IClientCallMetrics,
): interfaces.ContainerModuleCallBack => {
    return (bind, unbind, isBound, rebind) => {
        bind(ContentServiceClientConfig).toDynamicValue(config).inSingletonScope();
        if (clientCallMetrics) {
            bind(ContentServiceClientCallMetrics).toConstantValue(clientCallMetrics);
        }

        bind(CachingContentServiceClientProvider).toSelf().inSingletonScope();
        bind(CachingBlobServiceClientProvider).toSelf().inSingletonScope();
        bind(CachingWorkspaceServiceClientProvider).toSelf().inSingletonScope();
        bind(CachingIDEPluginClientProvider).toSelf().inSingletonScope();
        bind(CachingHeadlessLogServiceClientProvider).toSelf().inSingletonScope();
    };
};

export interface ContentServiceClientConfig {
    address: string;
    credentials: grpc.ChannelCredentials;
    options?: Partial<grpc.ClientOptions>;
}

type Client<T> = T & grpc.Client;

/**
 * ContentServiceClientProvider caches content service client
 */
export interface ContentServiceClientProvider<T> {
    getDefault(): Client<T>;
}

@injectable()
abstract class CachingClientProvider<T> implements ContentServiceClientProvider<T> {
    @inject(ContentServiceClientConfig) protected readonly clientConfig: ContentServiceClientConfig;

    @inject(ContentServiceClientCallMetrics)
    @optional()
    protected readonly clientCallMetrics: IClientCallMetrics;

    protected readonly interceptors: grpc.Interceptor[] = [];

    // gRPC connections can be used concurrently, even across services.
    // Thus it makes sense to cache them rather than create a new connection for each request.
    protected client: Client<T> | undefined;

    constructor(protected readonly createClient: (config: ContentServiceClientConfig) => Client<T>) {
        if (this.clientCallMetrics) {
            this.interceptors.push(createClientCallMetricsInterceptor(this.clientCallMetrics));
        }
    }

    getDefault(): Client<T> {
        let client = this.client;
        if (!client) {
            client = this.createClient(this.getConfig());
        } else if (!isConnectionAlive(client)) {
            client.close();

            client = this.createClient(this.getConfig());
        }

        this.client = client;
        return client;
    }

    protected getConfig(): ContentServiceClientConfig {
        const config = this.clientConfig;
        if (this.interceptors) {
            return {
                ...config,
                options: {
                    ...(config.options || {}),
                    interceptors: [...(config.options?.interceptors || []), ...this.interceptors],
                },
            };
        }
        return config;
    }
}

@injectable()
export class CachingContentServiceClientProvider extends CachingClientProvider<ContentServiceClient> {
    constructor() {
        super((config) => {
            return new ContentServiceClient(config.address, config.credentials, config.options);
        });
    }
}

@injectable()
export class CachingBlobServiceClientProvider extends CachingClientProvider<BlobServiceClient> {
    constructor() {
        super((config) => {
            return new BlobServiceClient(config.address, config.credentials, config.options);
        });
    }
}

@injectable()
export class CachingWorkspaceServiceClientProvider extends CachingClientProvider<WorkspaceServiceClient> {
    constructor() {
        super((config) => {
            return new WorkspaceServiceClient(config.address, config.credentials, config.options);
        });
    }
}

@injectable()
export class CachingIDEPluginClientProvider extends CachingClientProvider<IDEPluginServiceClient> {
    constructor() {
        super((config) => {
            return new IDEPluginServiceClient(config.address, config.credentials, config.options);
        });
    }
}

@injectable()
export class CachingHeadlessLogServiceClientProvider extends CachingClientProvider<HeadlessLogServiceClient> {
    constructor() {
        super((config) => {
            return new HeadlessLogServiceClient(config.address, config.credentials, config.options);
        });
    }
}

function isConnectionAlive(client: grpc.Client) {
    const cs = client.getChannel().getConnectivityState(false);
    return (
        cs == grpc.connectivityState.CONNECTING ||
        cs == grpc.connectivityState.IDLE ||
        cs == grpc.connectivityState.READY
    );
}
