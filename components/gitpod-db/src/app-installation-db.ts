/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { AppInstallation, AppInstallationPlatform } from '@gitpod/gitpod-protocol';

export const AppInstallationDB = Symbol('AppInstallationDB');

export interface AppInstallationDB {
    recordNewInstallation(
        platform: AppInstallationPlatform,
        source: 'user' | 'platform',
        installationID: string,
        ownerUserID?: string,
        platformUserID?: string,
    ): Promise<void>;
    recordUninstallation(
        platform: AppInstallationPlatform,
        source: 'user' | 'platform',
        installationID: string,
    ): Promise<void>;

    findInstallation(platform: AppInstallationPlatform, installationID: string): Promise<AppInstallation | undefined>;
}
