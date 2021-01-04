/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as path from "path";
import * as fs from "fs-extra";
import { v4 as uuidv4 } from 'uuid'
import * as filenamify from "filenamify";
import * as decompress from "decompress";
import { FileUri } from "@theia/core/lib/node/file-uri";
import { RecursivePartial } from "@theia/core/lib/common/types";
import { GitpodPluginLocator } from "./gitpod-plugin-locator";
import { PluginPackage } from "@theia/plugin-ext/lib/common/plugin-protocol";

export class GitpodPluginLocatorImpl implements GitpodPluginLocator {

    dispose(): void { }

    async find(fileUri: string, extensionsPath: string): Promise<{ fullPluginName: string; } | undefined> {
        try {
            const fsPath = FileUri.fsPath(fileUri);
            const extensionPath = path.join(extensionsPath, uuidv4());
            await fs.ensureDir(extensionPath);
            await fs.emptyDirSync(extensionPath);
            await decompress(fsPath, extensionPath);
            const pck = await this.resolvePackage(path.join(extensionPath, 'extension')) //vsix
                || await this.resolvePackage(path.join(extensionPath, 'package')); // npm
            if (pck && pck.publisher && pck.name && pck.version) {
                await this.decompressVSCodeBuiltInExtension(extensionPath);
                const { publisher, name, version } = pck;
                const fullPluginName = `${publisher}.${name}@${version}`.toLowerCase();
                const resolvedExtensionPath = path.join(extensionsPath, filenamify(fullPluginName));
                await fs.remove(resolvedExtensionPath);
                await fs.rename(extensionPath, resolvedExtensionPath);
                return { fullPluginName };
            }
            console.warn(`failed to extract an extension from ${fileUri}`);
            await fs.remove(extensionPath);
        } catch (e) {
            console.error(`failed to install an extension from ${fileUri}`, e);
            return undefined;
        }
    }

    protected async decompressVSCodeBuiltInExtension(extensionPath: string): Promise<void> {
        const vscodeNodeModulesPath = path.join(extensionPath, 'package', 'vscode_node_modules.zip');
        if (await fs.pathExists(vscodeNodeModulesPath)) {
            await decompress(vscodeNodeModulesPath, path.join(extensionPath, 'package', 'node_modules'));
        }
    }

    protected async resolvePackage(pluginPath: string): Promise<RecursivePartial<PluginPackage> | any> {
        try {
            return await fs.readJSON(path.join(pluginPath, 'package.json'));
        } catch {
            return undefined;
        }
    }

}