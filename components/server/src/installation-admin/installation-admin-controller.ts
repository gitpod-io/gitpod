/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject } from 'inversify';
import * as express from 'express';
import { InstallationAdminTelemetryDataProvider } from './telemetry-data-provider';

@injectable()
export class InstallationAdminController {
    @inject(InstallationAdminTelemetryDataProvider) protected readonly telemetryDataProvider: InstallationAdminTelemetryDataProvider;

    public create(): express.Application {
        const app = express();

        app.get('/data', async (req: express.Request, res: express.Response) => {
            res.status(200).json(await this.telemetryDataProvider.getTelemetryData());
        });

        return app;
    }
}
