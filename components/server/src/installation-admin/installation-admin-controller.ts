/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject } from 'inversify';
import * as express from 'express';
import { InstallationAdminDB, UserDB, WorkspaceDB } from '@gitpod/gitpod-db/lib';
import { Data } from '@gitpod/gitpod-protocol'

@injectable()
export class InstallationAdminController {
    @inject(InstallationAdminDB) protected readonly installationAdminDb: InstallationAdminDB;
    @inject(UserDB) protected readonly userDb: UserDB
    @inject(WorkspaceDB) protected readonly workspaceDb: WorkspaceDB

    public create(): express.Application {
        const app = express();

        app.get('/data', async (req: express.Request, res: express.Response) => {
            const data: Data = {
                installationAdmin: await this.installationAdminDb.getData(),
                totalUsers: await this.userDb.getUserCount(false),
                totalWorkspaces: await this.workspaceDb.getWorkspaceCount(),
                totalInstances: await this.workspaceDb.getInstanceCount(),
            } as Data;

            res.status(200).json(data);
        });

        return app;
    }
}
