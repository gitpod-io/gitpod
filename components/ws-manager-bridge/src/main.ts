/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Container, interfaces } from 'inversify';
import * as express from 'express';
import * as prometheusClient from 'prom-client';
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { Configuration } from './config';
import { WorkspaceManagerBridge, WorkspaceManagerBridgeFactory } from './bridge';
import { WorkspaceManagerClient } from '@gitpod/ws-manager/lib';
import * as grpc from "grpc";
import { MessageBusIntegration } from './messagebus-integration';
import { TypeORM } from '@gitpod/gitpod-db/lib/typeorm/typeorm';
import { TracingManager } from '@gitpod/gitpod-protocol/lib/util/tracing';

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

        const config = container.get<Configuration>(Configuration);
        const bridgeBuilder = container.get<interfaces.Factory<WorkspaceManagerBridge>>(WorkspaceManagerBridgeFactory);

        const bridges = await Promise.all(config.staticBridges.map(async c => {
            const bridge = bridgeBuilder() as WorkspaceManagerBridge;
            const clientProvider = async () => new WorkspaceManagerClient(c.managerAddress, grpc.credentials.createInsecure(), {
                "grpc.keepalive_timeout_ms": 1500,
                "grpc.keepalive_time_ms": 1000,
                "grpc.keepalive_permit_without_calls": 1
            });

            log.debug("starting bridge", c);
            bridge.startDatabaseUpdater(clientProvider).catch(e => log.error("cannot run database updater", e));

            const controllerInterval = config.controllerIntervalSeconds;
            if (controllerInterval > 0) {
                await bridge.startController(clientProvider, c.installation, controllerInterval, config.controllerMaxDisconnectSeconds);
            }

            return bridge;
        }));

        process.on('SIGTERM', async () => {
            log.info("SIGTERM received, stopping");
            bridges.forEach(b => b.dispose());

            if (metricsHttpServer) {
                metricsHttpServer.close((err: any) => {
                    if (err) {
                        log.warn(`error closing prometheus metrics server`, { err });
                    }
                });
            }
        });
        log.info("ws-manager-bridge is up and running");
        await new Promise((rs, rj) => {});
    } catch(err) {
        log.error("Error during startup. Exiting.", err);
        process.exit(1);
    }
}
