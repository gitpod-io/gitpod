/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

 import { injectable, inject } from 'inversify';

 import { TelemetryData } from "@gitpod/gitpod-protocol"
 import { InstallationAdminDB, UserDB, WorkspaceDB } from '@gitpod/gitpod-db/lib';

 @injectable()
 export class InstallationAdminTelemetryDataProvider {
    @inject(InstallationAdminDB) protected readonly installationAdminDb: InstallationAdminDB;
    @inject(UserDB) protected readonly userDb: UserDB
    @inject(WorkspaceDB) protected readonly workspaceDb: WorkspaceDB

     async getTelemetryData(): Promise<TelemetryData> {
            const data: TelemetryData = {
                installationAdmin: await this.installationAdminDb.getData(),
                totalUsers: 0,  //await this.userDb.getUserCount(true),
                totalWorkspaces: 0, //await this.workspaceDb.getWorkspaceCount(),
                totalInstances: 0,  //await this.workspaceDb.getInstanceCount(),
            } as TelemetryData;

            return data;
        }
 }
