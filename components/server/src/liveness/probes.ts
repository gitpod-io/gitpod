/**
 * Copyright (c) 2025 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import * as http from "http";
import express from "express";
import { inject, injectable } from "inversify";
import { LivenessController } from "./liveness-controller";
import { ReadinessController } from "./readiness-controller";
import { AddressInfo } from "net";

@injectable()
export class ProbesApp {
    private app: express.Application;
    private httpServer: http.Server | undefined = undefined;

    constructor(
        @inject(LivenessController) protected readonly livenessController: LivenessController,
        @inject(ReadinessController) protected readonly readinessController: ReadinessController,
    ) {
        const probesApp = express();
        probesApp.use("/live", this.livenessController.apiRouter);
        probesApp.use("/ready", this.readinessController.apiRouter);
        this.app = probesApp;
    }

    public async start(port: number): Promise<number> {
        await this.readinessController.start();

        return new Promise((resolve, reject) => {
            const probeServer = this.app.listen(port, () => {
                resolve((<AddressInfo>probeServer.address()).port);
            });
            this.httpServer = probeServer;
        });
    }

    public async stop(): Promise<void> {
        this.httpServer?.close();
        await this.readinessController.stop();
    }
}
