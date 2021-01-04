/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable } from 'inversify';

import { LocalStorageService } from "@theia/core/lib/browser";

@injectable()
export class GitpodLocalStorageService extends LocalStorageService {

    protected prefix(key: string): string {
        // Make the layout specific to the workspace
        // href contains the workspace id, so we don't need to fetch the id explicitly.
        const locationPrefix = window.location.href + ":";
        return locationPrefix + super.prefix(key);
    }
}