/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { InstallationAdmin } from "@gitpod/gitpod-protocol";

export const InstallationAdminDB = Symbol('InstallationAdminDB');
export interface InstallationAdminDB {
    getTelemetryData(): Promise<InstallationAdmin>;
}
