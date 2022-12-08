/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { v4 as uuidv4 } from "uuid";

const InstallationAdminSettingsPrototype = {
    sendTelemetry: true,
    sendCustomerID: true,
};

export type InstallationAdminSettings = typeof InstallationAdminSettingsPrototype;

export namespace InstallationAdminSettings {
    export function fields(): (keyof InstallationAdminSettings)[] {
        return Object.keys(InstallationAdminSettingsPrototype) as (keyof InstallationAdminSettings)[];
    }
}

export interface InstallationAdmin {
    id: string;
    settings: InstallationAdminSettings;
}

export interface TelemetryData {
    installationAdmin: InstallationAdmin;
    totalUsers: number;
    totalWorkspaces: number;
    totalInstances: number;
    licenseType: string;
    customerID?: string;
}

export namespace InstallationAdmin {
    export function createDefault(): InstallationAdmin {
        return {
            id: uuidv4(),
            settings: {
                ...InstallationAdminSettingsPrototype,
            },
        };
    }
}
