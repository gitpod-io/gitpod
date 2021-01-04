/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Disposable } from '@theia/core/lib/common/disposable';

export const GitpodPluginLocator = Symbol('GitpodPluginLocator');
export interface GitpodPluginLocator extends Disposable {

    find(fileUri: string, extensionsPath: string): Promise<{ fullPluginName: string } | undefined>;

}
