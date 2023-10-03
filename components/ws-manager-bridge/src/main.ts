/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Container } from "inversify";
import * as express from "express";
import * as prometheusClient from "prom-client";
import { log, LogrusLogLevel } from "@gitpod/gitpod-protocol/lib/util/logging";
import { DebugApp } from "@gitpod/gitpod-protocol/lib/util/debug-app";
import { TypeORM } from "@gitpod/gitpod-db/lib/typeorm/typeorm";
import { TracingManager } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { ClusterServiceServer } from "./cluster-service-server";
import { BridgeController } from "./bridge-controller";
import { AppClusterWorkspaceInstancesController } from "./app-cluster-instance-controller";
import { redisMetricsRegistry } from "@gitpod/gitpod-db/lib";

log.enableJSONLogging("ws-manager-bridge", undefined, LogrusLogLevel.getFromEnv());

export const start = async (container: Container) => {
    process.on("uncaughtException", function (err) {
        // fix for https://github.com/grpc/grpc-node/blob/master/packages/grpc-js/src/load-balancer-pick-first.ts#L309
        if (err && err.message && err.message.includes("reading 'startConnecting'")) {
            log.error("uncaughtException", err);
        } else {
            throw err;
        }
    });

    try {
        const db = container.get(TypeORM);
        await db.connect();

        const tracingManager = container.get(TracingManager);
        tracingManager.setup("ws-manager-bridge");

        const metricsApp = express();
        prometheusClient.collectDefaultMetrics();
        metricsApp.get("/metrics", async (req, res) => {
            res.set("Content-Type", prometheusClient.register.contentType);

            const mergedRegistry = prometheusClient.Registry.merge([prometheusClient.register, redisMetricsRegistry()]);
            res.send(await mergedRegistry.metrics());
        });
        const metricsPort = 9500;
        const metricsHttpServer = metricsApp.listen(metricsPort, "localhost", () => {
            log.info(`prometheus metrics server running on: localhost:${metricsPort}`);
        });

        const debugApp = container.get<DebugApp>(DebugApp);
        debugApp.start();

        const bridgeController = container.get<BridgeController>(BridgeController);
        await bridgeController.start();

        const clusterServiceServer = container.get<ClusterServiceServer>(ClusterServiceServer);
        await clusterServiceServer.start();

        const appClusterInstanceController = container.get<AppClusterWorkspaceInstancesController>(
            AppClusterWorkspaceInstancesController,
        );
        appClusterInstanceController.start();

        process.on("SIGTERM", async () => {
            log.info("SIGTERM received, stopping");
            bridgeController.dispose();

            if (metricsHttpServer) {
                metricsHttpServer.close((err: any) => {
                    if (err) {
                        log.warn(`error closing prometheus metrics server`, { err });
                    }
                });
            }
            clusterServiceServer.stop().then(() => log.info("gRPC shutdown completed"));
            appClusterInstanceController.dispose();
        });
        log.info("ws-manager-bridge is up and running");
        await new Promise((rs, rj) => {});
    } catch (err) {
        log.error("Error during startup. Exiting.", err);
        process.exit(1);
    }
};
