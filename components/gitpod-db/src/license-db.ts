/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

export const LicenseDB = Symbol('LicenseDB');

export interface LicenseDB {
  store(id: string, key: string): Promise<void>;
  get(): Promise<string | undefined>;
}
