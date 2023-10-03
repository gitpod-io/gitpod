/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import express from "express";
import { injectable } from "inversify";
import * as prometheusClient from "prom-client";
import { redisMetricsRegistry, registerDBMetrics } from "@gitpod/gitpod-db/lib";
import { registerServerMetrics } from "./prometheus-metrics";

@injectable()
export class MonitoringEndpointsApp {
    public create(): express.Application {
        const registry = prometheusClient.register;

        prometheusClient.collectDefaultMetrics({ register: registry });
        registerDBMetrics(registry);
        registerServerMetrics(registry);

        // Append redis metrics to default registry
        redisMetricsRegistry()
            .getMetricsAsArray()
            .forEach((metric) => registry.registerMetric(metric as any));

        const monApp = express();
        monApp.get("/metrics", async (req, res) => {
            try {
                res.set("Content-Type", registry.contentType);
                res.end(await registry.metrics());
            } catch (ex) {
                res.status(500).end(ex);
            }
        });

        return monApp;
    }
}
