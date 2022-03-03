/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { TheiaPlugin } from '@gitpod/gitpod-protocol';

export const TheiaPluginDB = Symbol('TheiaPluginDB');

export interface TheiaPluginDB {
    newPlugin(
        userId: string,
        pluginName: string,
        bucketName: string,
        pathFn: (id: string) => string,
    ): Promise<TheiaPlugin>;
    storePlugin(plugin: TheiaPlugin): Promise<TheiaPlugin>;
    delete(plugin: TheiaPlugin): Promise<void>;

    findById(id: string): Promise<TheiaPlugin | undefined>;
    findByPluginId(pluginId: string): Promise<TheiaPlugin[]>;

    exists(pluginId: string, predicate: { state?: TheiaPlugin.State; hash?: string }): Promise<boolean>;
}
