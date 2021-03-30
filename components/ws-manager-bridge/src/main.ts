/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Container } from 'inversify';
import * as express from 'express';
import * as prometheusClient from 'prom-client';
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { MessageBusIntegration } from './messagebus-integration';
import { TypeORM } from '@gitpod/gitpod-db/lib/typeorm/typeorm';
import { TracingManager } from '@gitpod/gitpod-protocol/lib/util/tracing';
import { ClusterServiceServer } from './cluster-service/cluster-service-server';
import { BridgeController } from './bridge-controller';

log.enableJSONLogging('ws-manager-bridge', process.env.VERSION);

export const start = async (container: Container) => {
    try {
        const db = container.get(TypeORM);
        await db.connect();

        const msgbus = container.get(MessageBusIntegration);
        await msgbus.connect();

        const tracingManager = container.get(TracingManager);
        tracingManager.setup("ws-manager-bridge");

        const metricsApp = express();
        prometheusClient.collectDefaultMetrics({ timeout: 5000 });
        metricsApp.get('/metrics', (req, res) => {
            res.send(prometheusClient.register.metrics().toString());
        });
        const metricsPort = 9500;
        const metricsHttpServer = metricsApp.listen(metricsPort, () => {
            log.info(`prometheus metrics server running on: ${metricsPort}`);
        });

        const bridgeController = container.get<BridgeController>(BridgeController);
        await bridgeController.start();

        const clusterServiceServer = container.get<ClusterServiceServer>(ClusterServiceServer);
        await clusterServiceServer.start();

        process.on('SIGTERM', async () => {
            log.info("SIGTERM received, stopping");
            bridgeController.dispose();

            if (metricsHttpServer) {
                metricsHttpServer.close((err: any) => {
                    if (err) {
                        log.warn(`error closing prometheus metrics server`, { err });
                    }
                });
            }
            clusterServiceServer.stop()
                .then(() => log.info("gRPC shutdown completed"));
        });
        log.info("ws-manager-bridge is up and running");
        await new Promise((rs, rj) => {});
    } catch(err) {
        log.error("Error during startup. Exiting.", err);
        process.exit(1);
    }
}
