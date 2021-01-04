/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable } from 'inversify';
import { HostedPluginReader } from '@theia/plugin-ext/lib/hosted/node/plugin-reader';
import { PluginPackage, PluginMetadata } from '@theia/plugin-ext';

@injectable()
export class GitpodPluginReader extends HostedPluginReader {

    readMetadata(plugin: PluginPackage): PluginMetadata {
        const metadata = super.readMetadata(plugin);
        let { icon, author } = (plugin as any);
        Object.assign(metadata.model, { icon, author });
        return metadata;
    }

}