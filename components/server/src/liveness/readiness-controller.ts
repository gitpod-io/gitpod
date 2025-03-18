/**
 * Copyright (c) 2025 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { injectable } from "inversify";
import express from "express";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";

/**
 * ReadinessController is mimicking the behavior server had in the past: Behave as there is not ready probe - except during shutdown.
 *
 * Why? In Gitpod, our error strategy has always been "keep it local and retry", instead of "fail loud and have someone else handle it".
 * As we don't want to change this now, we keep the same behavior for most of the services lifetime.
 *
 * Only during shutdown, we want to signal that the service is not ready anymore, to reduce error peaks.
 */
@injectable()
export class ReadinessController {
    private shutdown: boolean = false;

    get apiRouter(): express.Router {
        const router = express.Router();
        this.addReadinessHandler(router);
        return router;
    }

    public notifyShutdown(): void {
        this.shutdown = true;
    }

    protected addReadinessHandler(router: express.Router) {
        router.get("/", async (_, res) => {
            if (this.shutdown) {
                log.warn("Readiness check failed: Server is shutting down");
                res.status(503).send("Server is shutting down");
                return;
            }

            res.status(200).send("Ready");
            log.debug("Readiness check successful");
        });
    }
}
