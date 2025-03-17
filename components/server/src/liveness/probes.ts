/**
 * Copyright (c) 2025 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import express from "express";
import { inject, injectable } from "inversify";
import { LivenessController } from "./liveness-controller";
import { ReadinessController } from "./readiness-controller";

@injectable()
export class ProbesApp {
    constructor(
        @inject(LivenessController) protected readonly livenessController: LivenessController,
        @inject(ReadinessController) protected readonly readinessController: ReadinessController,
    ) {}

    public create(): express.Application {
        const probesApp = express();
        probesApp.use("/live", this.livenessController.apiRouter);
        probesApp.use("/ready", this.readinessController.apiRouter);
        return probesApp;
    }
}
