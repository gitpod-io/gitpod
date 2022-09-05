/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject } from "inversify";

import { TelemetryData } from "@gitpod/gitpod-protocol";
import * as opentracing from "opentracing";
import { InstallationAdminDB, UserDB, WorkspaceDB } from "@gitpod/gitpod-db/lib";
import { LicenseEvaluator } from "@gitpod/licensor/lib";

@injectable()
export class InstallationAdminTelemetryDataProvider {
    @inject(InstallationAdminDB) protected readonly installationAdminDb: InstallationAdminDB;
    @inject(UserDB) protected readonly userDb: UserDB;
    @inject(WorkspaceDB) protected readonly workspaceDb: WorkspaceDB;
    @inject(LicenseEvaluator) protected readonly licenseEvaluator: LicenseEvaluator;

    async getTelemetryData(): Promise<TelemetryData> {
        const span = opentracing.globalTracer().startSpan("getTelemetryData");
        try {
            const data: TelemetryData = {
                installationAdmin: await this.installationAdminDb.getData(),
                totalUsers: await this.userDb.getUserCount(true),
                activeUsers: await this.workspaceDb.getActiveUserCount(),
                totalWorkspaces: await this.workspaceDb.getWorkspaceCount(),
                totalInstances: await this.workspaceDb.getInstanceCount(),
                licenseType: this.licenseEvaluator.getLicenseData().type,
            } as TelemetryData;

            if (data.installationAdmin.settings.sendCustomerID) {
                data.customerID = this.licenseEvaluator.getLicenseData().payload.customerID;
            }

            return data;
        } finally {
            span.finish();
        }
    }
}
