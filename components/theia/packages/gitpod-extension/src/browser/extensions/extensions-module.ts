/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { interfaces as inversify, injectable, decorate } from 'inversify';
import { CommandRegistry, Disposable } from '@theia/core/lib/common';
import { WidgetFactory, WidgetManager, ViewContainerIdentifier, bindViewContribution, WebSocketConnectionProvider } from '@theia/core/lib/browser';
import { PluginServer, pluginServerJsonRpcPath } from '@theia/plugin-ext/lib/common/plugin-protocol';
import { FrontendApplicationContribution } from '@theia/core/lib/browser/frontend-application';
import { PluginFrontendViewContribution } from '@theia/plugin-ext/lib/main/browser/plugin-frontend-view-contribution';
import { PluginApiFrontendContribution } from '@theia/plugin-ext/lib/main/browser/plugin-frontend-contribution';
import { PluginExtDeployCommandService } from '@theia/plugin-ext/lib/main/browser/plugin-ext-deploy-command';
import { HostedPluginSupport } from '@theia/plugin-ext/lib/hosted/browser/hosted-plugin';
import { VSXExtension } from '@theia/vsx-registry/lib/browser/vsx-extension';
import { VSXExtensionsViewContainer } from '@theia/vsx-registry/lib/browser/vsx-extensions-view-container';
import { VSXExtensionsWidget } from '@theia/vsx-registry/lib/browser/vsx-extensions-widget';
import { VSXExtensionsSourceOptions } from '@theia/vsx-registry/lib/browser/vsx-extensions-source';
import { VSXExtensionsContribution } from '@theia/vsx-registry/lib/browser/vsx-extensions-contribution';
import { OpenVSXExtensionProvider, openVSXExtensionProviderPath } from '../../common/openvsx-extension-provider';
import { gitpodPluginPath, GitpodPluginService } from '../../common/gitpod-plugin-service';
import { GitpodInfoService } from '../../common/gitpod-info';
import { GitpodServiceProvider } from '../gitpod-service-provider';
import { LoadingExtensionsNode, ExtensionNodes, ExtensionsSourceOptions } from './extensions-source';
import { GitpodPluginSupport } from './gitpod-plugin-support';
import { ExtensionsWidget } from './extensions-widget';
import { GitpodVSXExtension } from './gitpod-vsx-extension';
import { EXTENSIONS_VIEW_CONTAINER_ID, ExtensionsViewContribution } from './extensions-view-contribution';
import { ExtensionsInstaller } from './extensions-installer';
import { GitpodPluginServer } from './gitpod-plugin-server';
import { DisabledVSXExtensionsContribution } from './disabled-vsx-extensions-contribution';
import { addUserInfoToSearchResult } from './search-result-enhancement';
import { CachedUserStorage } from '../gitpod-user-storage-cached';

export const extensionsModule: inversify.ContainerModuleCallBack = (bind, unbind, isBound, rebind) => {
    rebind(PluginFrontendViewContribution).toConstantValue({
        registerCommands: () => { },
        registerMenus: () => { },
        registerKeybindings: () => { }
    } as any);

    const pluginApiFrontendContribution = class extends PluginApiFrontendContribution {
        registerCommands(commands: CommandRegistry): void {
            const registerCommand = commands.registerCommand;
            commands.registerCommand = (command, handler) => {
                if (command.category === PluginExtDeployCommandService.COMMAND.category) {
                    return Disposable.NULL;
                }
                return registerCommand.bind(commands)(command, handler);
            }
            super.registerCommands(commands);
            commands.registerCommand = registerCommand;
        }
    };
    decorate(injectable(), pluginApiFrontendContribution);
    rebind(PluginApiFrontendContribution).to(pluginApiFrontendContribution);

    rebind(HostedPluginSupport).to(GitpodPluginSupport).inSingletonScope();

    bind(LoadingExtensionsNode).toSelf().inSingletonScope();
    bind(ExtensionNodes).toSelf().inSingletonScope();
    bind(WidgetFactory).toDynamicValue(({ container }) => ({
        id: ExtensionsWidget.FACTORY_ID,
        createWidget: (options: ExtensionsSourceOptions) => ExtensionsWidget.createWidget(container, options)
    }));
    rebind(VSXExtension).to(GitpodVSXExtension)
    bind(WidgetFactory).toDynamicValue(({ container }) => ({
        id: EXTENSIONS_VIEW_CONTAINER_ID,
        createWidget: async () => {
            const child = container.createChild();
            child.bind(ViewContainerIdentifier).toConstantValue({
                id: EXTENSIONS_VIEW_CONTAINER_ID,
                progressLocationId: 'extensions'
            });
            child.bind(VSXExtensionsViewContainer).toSelf();
            const viewContainer = child.get(VSXExtensionsViewContainer);
            viewContainer.id = EXTENSIONS_VIEW_CONTAINER_ID;
            const widgetManager = child.get(WidgetManager);
            // Search result
            const searchResultWidget: VSXExtensionsWidget = await widgetManager.getOrCreateWidget(VSXExtensionsWidget.ID, {
                id: VSXExtensionsSourceOptions.SEARCH_RESULT
            });
            addUserInfoToSearchResult(searchResultWidget);
            viewContainer.addWidget(searchResultWidget, {
                canHide: true,
                initiallyCollapsed: false,
                initiallyHidden: false
            });
            // Installed extensions for workspace
            const workspaceExtensionsWidget = await widgetManager.getOrCreateWidget(ExtensionsWidget.FACTORY_ID, <ExtensionsSourceOptions>{
                pluginKind: 'workspace'
            });
            viewContainer.addWidget(workspaceExtensionsWidget, {
                canHide: true,
                initiallyCollapsed: false,
                initiallyHidden: false
            });
            // Installed extensions for user
            const userExtensionsWidget = await widgetManager.getOrCreateWidget(ExtensionsWidget.FACTORY_ID, <ExtensionsSourceOptions>{
                pluginKind: 'user'
            });
            viewContainer.addWidget(userExtensionsWidget, {
                canHide: true,
                initiallyCollapsed: false,
                initiallyHidden: false
            });
            // Built-in extensions
            const builtinExtensionsWidget = await widgetManager.getOrCreateWidget(ExtensionsWidget.FACTORY_ID, <ExtensionsSourceOptions>{
                pluginKind: 'builtin'
            });
            viewContainer.addWidget(builtinExtensionsWidget, {
                canHide: true,
                initiallyCollapsed: true,
                initiallyHidden: false
            });
            return viewContainer;
        }
    }));
    bindViewContribution(bind, ExtensionsViewContribution);
    bind(FrontendApplicationContribution).toService(ExtensionsViewContribution);
    bind(ExtensionsInstaller).toSelf().inSingletonScope();
    rebind(VSXExtensionsContribution).to(DisabledVSXExtensionsContribution).inSingletonScope();

    bind(GitpodPluginService).toDynamicValue(ctx => {
        const provider = ctx.container.get(WebSocketConnectionProvider);
        const client = ctx.container.get(HostedPluginSupport);
        return provider.createProxy<GitpodPluginService>(gitpodPluginPath, client);
    }).inSingletonScope();

    rebind(PluginServer).toDynamicValue(ctx => {
        const provider = ctx.container.get(WebSocketConnectionProvider);
        const original = provider.createProxy<PluginServer>(pluginServerJsonRpcPath);
        const serviceProvider = ctx.container.get(GitpodServiceProvider);
        const infoService = ctx.container.get<GitpodInfoService>(GitpodInfoService);
        const cachedUserStorage = ctx.container.get<CachedUserStorage>(CachedUserStorage);
        return new GitpodPluginServer(original, serviceProvider, infoService, cachedUserStorage);
    }).inSingletonScope();

    bind(OpenVSXExtensionProvider).toDynamicValue(ctx => {
        const provider = ctx.container.get(WebSocketConnectionProvider);
        return provider.createProxy<OpenVSXExtensionProvider>(openVSXExtensionProviderPath);
    }).inSingletonScope();
};
