/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

require("reflect-metadata");

import { ContainerModule } from "inversify";
import { MessageBusHelper, MessageBusHelperImpl } from "@gitpod/gitpod-messagebus/lib";
import { MessagebusConfiguration } from "@gitpod/gitpod-messagebus/lib/config";
import { MessageBusIntegration } from "./messagebus-integration";
import { Configuration } from "./config";
import * as fs from "fs";
import { WorkspaceManagerBridgeFactory, WorkspaceManagerBridge } from "./bridge";
import { TracingManager } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { PrometheusMetricsExporter } from "./prometheus-metrics-exporter";
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
import { PreparingUpdateEmulator, PreparingUpdateEmulatorFactory } from "./preparing-update-emulator";
import { PrebuildStateMapper } from "./prebuild-state-mapper";
import { PrebuildUpdater, PrebuildUpdaterNoOp } from "./prebuild-updater";
import { DebugApp } from "@gitpod/gitpod-protocol/lib/util/debug-app";
import { Client } from "@gitpod/gitpod-protocol/lib/experiments/types";
import { getExperimentsClientForBackend } from "@gitpod/gitpod-protocol/lib/experiments/configcat-server";
import { ClusterSyncService } from "./cluster-sync-service";
import { WorkspaceInstanceController, WorkspaceInstanceControllerImpl } from "./workspace-instance-controller";
import { AppClusterWorkspaceInstancesController } from "./app-cluster-instance-controller";

export const containerModule = new ContainerModule((bind) => {
    bind(MessagebusConfiguration).toSelf().inSingletonScope();
    bind(MessageBusHelper).to(MessageBusHelperImpl).inSingletonScope();
    bind(MessageBusIntegration).toSelf().inSingletonScope();

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
    bind(ClusterSyncService).toSelf().inSingletonScope();

    bind(TracingManager).toSelf().inSingletonScope();

    bind(PrometheusMetricsExporter).toSelf().inSingletonScope();

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

    bind(PreparingUpdateEmulator).toSelf().inRequestScope();
    bind(PreparingUpdateEmulatorFactory).toAutoFactory(PreparingUpdateEmulator);

    bind(PrebuildStateMapper).toSelf().inSingletonScope();
    bind(PrebuildUpdater).to(PrebuildUpdaterNoOp).inSingletonScope();

    bind(DebugApp).toSelf().inSingletonScope();

    bind(Client).toDynamicValue(getExperimentsClientForBackend).inSingletonScope();

    // transient to make sure we're creating a separate instance every time we ask for it
    bind(WorkspaceInstanceController).to(WorkspaceInstanceControllerImpl).inTransientScope();

    bind(AppClusterWorkspaceInstancesController).toSelf().inSingletonScope();
});
