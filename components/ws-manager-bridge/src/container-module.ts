/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

require("reflect-metadata");

import { ContainerModule } from "inversify";
import { Configuration } from "./config";
import * as fs from "fs";
import { WorkspaceManagerBridgeFactory, WorkspaceManagerBridge } from "./bridge";
import { Metrics } from "./metrics";
import { BridgeController, WorkspaceManagerClientProviderConfigSource } from "./bridge-controller";
import { filePathTelepresenceAware } from "@gitpod/gitpod-protocol/lib/env";
import {
    WorkspaceManagerClientProvider,
    IWorkspaceManagerClientCallMetrics,
} from "@gitpod/ws-manager/lib/client-provider";
import {
    WorkspaceManagerClientProviderCompositeSource,
    WorkspaceManagerClientProviderDBSource,
    WorkspaceManagerClientProviderSource,
} from "@gitpod/ws-manager/lib/client-provider-source";
import { ClusterService, ClusterServiceServer } from "./cluster-service-server";
import { IAnalyticsWriter } from "@gitpod/gitpod-protocol/lib/analytics";
import { newAnalyticsWriterFromEnv } from "@gitpod/gitpod-protocol/lib/util/analytics";
import { IClientCallMetrics } from "@gitpod/gitpod-protocol/lib/util/grpc";
import { PrometheusClientCallMetrics } from "@gitpod/gitpod-protocol/lib/messaging/client-call-metrics";
import { PrebuildStateMapper } from "./prebuild-state-mapper";
import { DebugApp } from "@gitpod/gitpod-protocol/lib/util/debug-app";
import { Client as ExperimentsClient } from "@gitpod/gitpod-protocol/lib/experiments/types";
import { getExperimentsClientForBackend } from "@gitpod/gitpod-protocol/lib/experiments/configcat-server";
import { WorkspaceInstanceController, WorkspaceInstanceControllerImpl } from "./workspace-instance-controller";
import { AppClusterWorkspaceInstancesController } from "./app-cluster-instance-controller";
import { PrebuildUpdater } from "./prebuild-updater";
import { Redis } from "ioredis";
import { RedisPublisher, newRedisClient } from "@gitpod/gitpod-db/lib";

export const containerModule = new ContainerModule((bind) => {
    bind(BridgeController).toSelf().inSingletonScope();

    bind(PrometheusClientCallMetrics).toSelf().inSingletonScope();
    bind(IClientCallMetrics).to(PrometheusClientCallMetrics).inSingletonScope();
    bind(IWorkspaceManagerClientCallMetrics).toService(IClientCallMetrics);

    bind(WorkspaceManagerClientProvider).toSelf().inSingletonScope();
    bind(WorkspaceManagerClientProviderCompositeSource).toSelf().inSingletonScope();
    bind(WorkspaceManagerClientProviderSource).to(WorkspaceManagerClientProviderConfigSource).inSingletonScope();
    bind(WorkspaceManagerClientProviderSource).to(WorkspaceManagerClientProviderDBSource).inSingletonScope();

    bind(WorkspaceManagerBridge).toSelf().inRequestScope();
    bind(WorkspaceManagerBridgeFactory).toAutoFactory(WorkspaceManagerBridge);

    bind(ClusterServiceServer).toSelf().inSingletonScope();
    bind(ClusterService).toSelf().inRequestScope();

    bind(Metrics).toSelf().inSingletonScope();

    bind(Configuration)
        .toDynamicValue((ctx) => {
            let cfgPath = process.env.WSMAN_BRIDGE_CONFIGPATH;
            if (!cfgPath) {
                throw new Error("No WSMAN_BRIDGE_CONFIGPATH env var set - cannot start without config!");
            }
            cfgPath = filePathTelepresenceAware(cfgPath);

            const cfg = fs.readFileSync(cfgPath);
            const result = JSON.parse(cfg.toString());
            return result;
        })
        .inSingletonScope();

    bind(IAnalyticsWriter).toDynamicValue(newAnalyticsWriterFromEnv).inSingletonScope();

    bind(PrebuildStateMapper).toSelf().inSingletonScope();
    bind(PrebuildUpdater).toSelf().inSingletonScope();

    bind(DebugApp).toSelf().inSingletonScope();

    bind(ExperimentsClient).toDynamicValue(getExperimentsClientForBackend).inSingletonScope();

    // transient to make sure we're creating a separate instance every time we ask for it
    bind(WorkspaceInstanceController).to(WorkspaceInstanceControllerImpl).inTransientScope();

    bind(AppClusterWorkspaceInstancesController).toSelf().inSingletonScope();

    bind(Redis).toDynamicValue((ctx) => {
        const config = ctx.container.get<Configuration>(Configuration);
        const [host, port] = config.redis.address.split(":");
        const username = process.env.REDIS_USERNAME;
        const password = process.env.REDIS_PASSWORD;
        return newRedisClient({ host, port: Number(port), connectionName: "server", username, password });
    });
    bind(RedisPublisher).toSelf().inSingletonScope();
});
