/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import * as express from "express";
import { injectable } from "inversify";
import { registerServerMetrics } from "../../src/prometheus-metrics";
import * as prometheusClient from "prom-client";
import { registerDBMetrics } from "@gitpod/gitpod-db/lib";

@injectable()
export class MonitoringEndpointsAppEE {
    public create(): express.Application {
        const registry = prometheusClient.register;

        prometheusClient.collectDefaultMetrics({ register: registry });
        registerDBMetrics(registry);
        registerServerMetrics(registry);

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
