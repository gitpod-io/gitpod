/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { injectable, inject } from "inversify";
import * as express from "express";
import * as opentracing from "opentracing";
import { InstallationAdminTelemetryDataProvider } from "./telemetry-data-provider";

@injectable()
export class InstallationAdminController {
    @inject(InstallationAdminTelemetryDataProvider)
    protected readonly telemetryDataProvider: InstallationAdminTelemetryDataProvider;

    public create(): express.Application {
        const app = express();

        app.get("/data", async (req: express.Request, res: express.Response) => {
            const spanCtx =
                opentracing.globalTracer().extract(opentracing.FORMAT_HTTP_HEADERS, req.headers) || undefined;
            const span = opentracing.globalTracer().startSpan("telemetryDataEndpoint", { childOf: spanCtx });
            try {
                res.status(200).json(await this.telemetryDataProvider.getTelemetryData());
            } finally {
                span.finish();
            }
        });

        return app;
    }
}
