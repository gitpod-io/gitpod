/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { InstallationAdmin, InstallationAdminSettings } from "@gitpod/gitpod-protocol";

export const InstallationAdminDB = Symbol('InstallationAdminDB');
export interface InstallationAdminDB {
    getData(): Promise<InstallationAdmin>;
    setSettings(settings: Partial<InstallationAdminSettings>): Promise<void>;
}
