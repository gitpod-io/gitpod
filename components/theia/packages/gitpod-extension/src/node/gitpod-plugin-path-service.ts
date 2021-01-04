/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable } from 'inversify';
import { PluginPathsServiceImpl } from '@theia/plugin-ext/lib/main/node/paths/plugin-paths-service';

@injectable()
export class GitpodPluginPathService extends PluginPathsServiceImpl {

    getTheiaDirPath(): Promise<string> {
        return Promise.resolve('/workspace/.vscode');
    }

}