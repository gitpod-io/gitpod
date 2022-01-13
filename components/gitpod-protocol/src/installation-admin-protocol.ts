/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

export interface InstallationAdminSettings {
    sendTelemetry: boolean;
}

export interface InstallationAdmin {
    id: string;
    settings: InstallationAdminSettings;
}