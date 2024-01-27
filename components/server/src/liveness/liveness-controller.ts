/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { injectable, inject } from "inversify";
import express from "express";
import * as prom from "prom-client";
import { Config } from "../config";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";

@injectable()
export class LivenessController {
    @inject(Config) protected readonly config: Config;

    get apiRouter(): express.Router {
        const router = express.Router();
        this.addLivenessHandler(router);
        return router;
    }

    protected addLivenessHandler(router: express.Router) {
        router.get("/", async (_, res) => {
            if (!this.config.maximumEventLoopLag) {
                res.end();
                return;
            }
            const metrics = await prom.register.getMetricsAsJSON();
            const metric = metrics.find((m) => m.name === "nodejs_eventloop_lag_seconds");
            if (!metric) {
                log.error("unable to find nodejs event loop metric, liveness probe will not function");
                res.end();
                return;
            }
            const value = (metric as any).values[0].value;
            res.status(value > this.config.maximumEventLoopLag ? 500 : 200);
            res.end(`${value}`);
        });
    }
}
