/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable } from "inversify";
import { PluginDeployerEntry, DeployedPlugin } from "@theia/plugin-ext";
import { HostedPluginReader } from "@theia/plugin-ext/lib/hosted/node/plugin-reader";
import { HostedPluginDeployerHandler } from "@theia/plugin-ext/lib/hosted/node/hosted-plugin-deployer-handler";

@injectable()
export class GitpodPluginDeployerHandler extends HostedPluginDeployerHandler {

    protected extensionMapping = new Map<string, string[]>();

    async deployFrontendPlugins(): Promise<void> {
        // disable frontend plgins but resolve the first deployment
        super.deployFrontendPlugins([]);
    }

    async deployBackendPlugins(backendPlugins: PluginDeployerEntry[]): Promise<void> {
        const plugins = new Map<string, DeployedPlugin>();
        const extensionMapping = new Map<string, string[]>();
        for (const plugin of backendPlugins) {
            const pluginPath = plugin.path();
            try {
                const reader: HostedPluginReader = this['reader'];
                const manifest = await reader.readPackage(pluginPath);
                if (!manifest) {
                    continue;
                }
                const metadata = reader.readMetadata(manifest);
                const extensions = extensionMapping.get(metadata.model.id);
                if (!extensions) {
                    const deployed: DeployedPlugin = { metadata };
                    deployed.contributes = reader.readContribution(manifest);
                    plugins.set(metadata.model.id, deployed);
                    extensionMapping.set(metadata.model.id, [plugin.id()]);
                    console.info(`Deploying VS Code extension "${metadata.model.id}@${metadata.model.version}" from "${metadata.model.entryPoint.backend || pluginPath}"`);
                } else {
                    extensions.push(plugin.id());
                }
            } catch (e) {
                console.error(`Failed to deploy VS Code extension from '${pluginPath}' path`, e);
            }
        }
        this.extensionMapping = extensionMapping;
        Object.assign(this, { deployedBackendPlugins: plugins });
        // in order to resolve first deployment
        await super.deployBackendPlugins([]);
    }

    *getFullPluginNames(): IterableIterator<string> {
        for (const id of this.extensionMapping.keys()) {
            const fullPluginNames = this.extensionMapping.get(id);
            if (fullPluginNames) {
                for (const fullPluginName of fullPluginNames) {
                    yield fullPluginName;
                }
            }
        }
    }

    /**
     * key is an id of `${publisher}.${name}` form
     * value is a full plugin name of `${publisher}.${name}@${version}` form
     */
    getExtensionKeys(): string[] {
        return [...this.extensionMapping.keys()];
    }

    getExtension(id: string): string | undefined {
        return this.getExtensions(id)[0];
    }

    getExtensions(id: string): string[] {
        return this.extensionMapping.get(id) || [];
    }

}