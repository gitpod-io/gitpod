/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject } from 'inversify';
import * as express from 'express';
import { InstallationAdminDB, UserDB } from '@gitpod/gitpod-db/lib';
import { Data } from '@gitpod/gitpod-protocol'

@injectable()
export class InstallationAdminController {
    @inject(InstallationAdminDB) protected readonly installationAdminDb: InstallationAdminDB;
    @inject(UserDB) protected readonly userDb: UserDB

    public create(): express.Application {
        const app = express();

        app.get('/data', async (req: express.Request, res: express.Response) => {
            const installationAdmin = await this.installationAdminDb.getData();
            const totalUsers = await this.userDb.getUserCount(false);
            res.status(200).json({ installationAdmin, totalUsers } as Data);
        });

        return app;
    }
}
