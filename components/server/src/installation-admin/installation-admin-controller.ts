/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject } from 'inversify';
import * as express from 'express';
import { InstallationAdminDB } from '@gitpod/gitpod-db/lib';

@injectable()
export class InstallationAdminController {
    @inject(InstallationAdminDB) protected readonly installationAdminDb: InstallationAdminDB;

    public create(): express.Application {
        const app = express();

        app.get('/data', async (req: express.Request, res: express.Response) => {
            const data = await this.installationAdminDb.getData();

            res.status(200).json(data);
        });

        return app;
    }
}
