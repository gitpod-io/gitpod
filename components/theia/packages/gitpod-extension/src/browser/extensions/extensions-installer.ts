/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject } from 'inversify';
import URI from '@theia/core/lib/common/uri';
import { MessageService } from '@theia/core/lib/common/message-service';
import { LabelProvider } from '@theia/core/lib/browser/label-provider';
import { CancellationTokenSource, CancellationToken } from '@theia/core/lib/common/cancellation';
import { ErrorCodes } from '@gitpod/gitpod-protocol/lib/messaging/error';
import { InstallPluginsParams, ResolvedPluginKind } from '@gitpod/gitpod-protocol';
import { GitpodPluginService, DeployedPlugin } from '../../common/gitpod-plugin-service';
import { OpenVSXExtensionProvider } from '../../common/openvsx-extension-provider';
import { GitpodServiceProvider } from '../gitpod-service-provider';

@injectable()
export class ExtensionsInstaller {

    @inject(MessageService)
    protected readonly messageService: MessageService;

    @inject(LabelProvider)
    protected readonly labelProvider: LabelProvider;

    @inject(OpenVSXExtensionProvider)
    protected readonly extensionProvider: OpenVSXExtensionProvider;

    @inject(GitpodPluginService)
    protected readonly pluginService: GitpodPluginService;

    @inject(GitpodServiceProvider)
    protected readonly serviceProvider: GitpodServiceProvider;

    async install(fileUris: string[], pluginKind: ResolvedPluginKind): Promise<void> {
        const cancellationSource = new CancellationTokenSource();
        const progress = await this.messageService.showProgress({ text: 'Installing extensions...' }, () => cancellationSource.cancel());
        try {
            let done = 0;
            const total = fileUris.length;
            const pluginIds: string[] = [];
            const token = cancellationSource.token;
            const processing: Promise<void>[] = [];
            for (const fileUri of fileUris) {
                processing.push((async () => {
                    const pluginId = await this.doInstall(fileUri, token);
                    if (pluginId) {
                        pluginIds.push(pluginId);
                    }
                    done++;
                    progress.report({ work: { done, total } });
                })());
            }
            await Promise.all(processing);
            if (token.isCancellationRequested) {
                return;
            }
            await this.installPlugins({ pluginIds }, pluginKind, token);
        } finally {
            progress.cancel();
        }
    }

    protected async doInstall(fileUri: string, token: CancellationToken): Promise<string | undefined> {
        const fileName = this.labelProvider.getName(new URI(fileUri));
        const found = await this.pluginService.find({ fileUris: [fileUri] }, token);
        if (token.isCancellationRequested) {
            return;
        }

        const { server } = await this.serviceProvider.getService();
        if (token.isCancellationRequested) {
            return;
        }

        if (fileUri in found) {
            for (const { fullPluginName } of found[fileUri]) {
                if (token.isCancellationRequested) {
                    return;
                }

                try {
                    const targetUrl = await server.preparePluginUpload({ fullPluginName });
                    const pluginId = await this.pluginService.upload({ fullPluginName, targetUrl });
                    return pluginId;
                } catch (error) {
                    if (error && error.code == ErrorCodes.CONFLICT) {
                        // don't need to be uploaded
                    } else {
                        this.messageService.error(`Failed to share ${fullPluginName} extension from ${fileName}. Try to upload again.`);
                        console.error(`Failed to share ${fullPluginName} extension from ${fileName}`, error);
                    }
                }
            }
        } else {
            this.messageService.error(`A valid extension cannot be found in ${fileName}.`);
        }
    }

    protected async installPlugins(params: InstallPluginsParams, pluginKind: ResolvedPluginKind, token: CancellationToken): Promise<void> {
        if (pluginKind === 'user') {
            const { server } = await this.serviceProvider.getService();
            if (token.isCancellationRequested) {
                return;
            }
            if (await server.installUserPlugins(params)) {
                await this.pluginService.deploy();
            }
        } else {
            await this.pluginService.install(params, token);
        }
    }

    async uninstall(plugin: DeployedPlugin): Promise<void> {
        const cancellationSource = new CancellationTokenSource();
        const progress = await this.messageService.showProgress({ text: `Uninstalling ${plugin.pluginId}...` }, () => cancellationSource.cancel());
        try {
            await this.doUninstall(plugin, cancellationSource.token);
        } finally {
            progress.cancel();
        }
    }

    protected async doUninstall(plugin: DeployedPlugin, token: CancellationToken): Promise<void> {
        const pluginId = plugin.pluginId;
        if (plugin.kind === 'user') {
            const { server } = this.serviceProvider.getService();
            if (token.isCancellationRequested) {
                return;
            }
            if (await server.uninstallUserPlugin({ pluginId })) {
                await this.pluginService.deploy();
            }
        } else {
            await this.pluginService.uninstall({ pluginId }, token);
        }
    }

    async downloadAndInstall(id: string, version: string | undefined, pluginKind: ResolvedPluginKind) {
        const cancellationSource = new CancellationTokenSource();
        const progress = await this.messageService.showProgress({ text: `Installing ${id}${version ? ` version ${version}` : ''}...` }, () => cancellationSource.cancel());
        try {
            const token = cancellationSource.token;
            const fileUri = await this.extensionProvider.downloadExtension(id, version);
            progress.report({ work: { done: 1, total: 2 } });

            const pluginId = await this.doInstall(fileUri, token);
            progress.report({ work: { done: 2, total: 2 } });

            if (pluginId && !token.isCancellationRequested) {
                await this.installPlugins({ pluginIds: [pluginId] }, pluginKind, token);
            }
        } finally {
            progress.cancel();
        }
    }

    async updateVersion(plugin: DeployedPlugin, id: string, version: string | undefined): Promise<void> {
        const cancellationSource = new CancellationTokenSource();
        const progress = await this.messageService.showProgress({ text: `Updating ${id}${version ? ` to version ${version}` : ''}...` }, () => cancellationSource.cancel());
        try {
            const token = cancellationSource.token;
            const fileUri = await this.extensionProvider.downloadExtension(id, version);
            progress.report({ work: { done: 1, total: 3 } });

            await this.doUninstall(plugin, token);
            progress.report({ work: { done: 2, total: 3 } });

            const pluginId = await this.doInstall(fileUri, token);
            progress.report({ work: { done: 3, total: 3 } });

            if (pluginId && !token.isCancellationRequested) {
                await this.installPlugins({ pluginIds: [pluginId] }, plugin.kind, token);
            }
        } finally {
            progress.cancel();
        }
    }

}
