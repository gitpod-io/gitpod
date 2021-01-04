/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as React from 'react';
import { injectable, inject, postConstruct } from 'inversify';
import { MessageService, Emitter } from '@theia/core';
import { TreeElement, TreeSource } from '@theia/core/lib/browser/source-tree/tree-source';
import { PluginMetadata, getPluginId } from '@theia/plugin-ext/lib/common/plugin-protocol';
import { DeployedPlugin, GitpodPluginModel, GitpodPluginService } from '../../common/gitpod-plugin-service';
import { HostedPluginSupport } from '@theia/plugin-ext/lib/hosted/browser/hosted-plugin';
import { GitpodPluginSupport, GitpodPluginData } from './gitpod-plugin-support';
import { ResolvedPluginKind, UserInfo } from '@gitpod/gitpod-protocol';
import { GitpodServiceProvider } from '../gitpod-service-provider';
import { GitpodInfoService } from '../../common/gitpod-info';
import { ExtensionsInstaller } from './extensions-installer';

@injectable()
export class ExtensionNodes {

    @inject(HostedPluginSupport)
    protected readonly pluginSupport: GitpodPluginSupport;

    @inject(GitpodPluginService)
    protected readonly pluginService: GitpodPluginService;

    @inject(ExtensionsInstaller)
    protected readonly extensionsInstaller: ExtensionsInstaller;

    @inject(MessageService)
    protected readonly messageService: MessageService;

    @inject(GitpodInfoService)
    protected readonly infoProvider: GitpodInfoService;

    @inject(GitpodServiceProvider)
    protected readonly serviceProvider: GitpodServiceProvider;

    protected _workspaceOwner: UserInfo | undefined;
    get workspaceOwner(): UserInfo | undefined {
        return this._workspaceOwner;
    }

    protected isWorkspaceOwner = false;
    hasWriteAccess(pluginKind: ResolvedPluginKind | undefined): boolean {
        return pluginKind === 'workspace' || (
            pluginKind === 'user' && this.isWorkspaceOwner
        );
    }

    protected nodes = new Map<string, ExtensionNode>();
    protected readonly onDidChangeEmitter = new Emitter<void>();
    readonly onDidChange = this.onDidChangeEmitter.event;
    protected fireDidChange(): void {
        this.onDidChangeEmitter.fire(undefined);
    }

    protected _loading = true;
    get loading(): boolean {
        return this._loading;
    }

    isEmpty(pluginKind: ResolvedPluginKind): boolean {
        for (const node of this.nodes.values()) {
            if (node.pluginKind === pluginKind) {
                return false;
            }
        }
        return true;
    }

    *getNodes(pluginKind: ResolvedPluginKind): IterableIterator<ExtensionNode> {
        for (const node of this.nodes.values()) {
            if (node.pluginKind === pluginKind) {
                yield node;
            }
        }
    }

    @postConstruct()
    protected async init(): Promise<void> {
        const [gitpodInfo, { server }] = await Promise.all([
            this.infoProvider.getInfo(),
            this.serviceProvider.getService()
        ]);
        const [workspaceOwner, isWorkspaceOwner] = await Promise.all([
            server.getWorkspaceOwner(gitpodInfo.workspaceId),
            server.isWorkspaceOwner(gitpodInfo.workspaceId)
        ])
        this._workspaceOwner = workspaceOwner;
        this.isWorkspaceOwner = isWorkspaceOwner;
        this.update();
        this.pluginSupport.onDidChangePlugins(() => this.update());
    }

    protected update(): void {
        const data: GitpodPluginData = this.pluginSupport;
        this._loading = false;
        const toUninstall = new Set(this.nodes.keys());
        for (const plugin of data.plugins) {

            const node = this.toNode(plugin);
            toUninstall.delete(node.id);
            node.installed = !!data.deployed[plugin.model.id];

            // don't assign undefined in order to preserve last deployed state
            if (data.deployed[plugin.model.id]) {
                node.deployed = data.deployed[plugin.model.id];
            }
        }
        for (const id of toUninstall) {
            const node = this.nodes.get(id)!;
            if (node.installed) {
                node.installed = false;
            } else {
                this.nodes.delete(id);
            }
        }
        this.nodes = new Map([...this.nodes.entries()].sort(([, a], [, b]) => a.plugin.model.name.localeCompare(b.plugin.model.name)));
        this.fireDidChange();
    }

    protected toNode(plugin: PluginMetadata): ExtensionNode {
        const id = plugin.model.id;
        if (this.nodes.has(id)) {
            const node = this.nodes.get(id)!;
            node.plugin = plugin;
            return node;
        } else {
            const node: ExtensionNode = new ExtensionNode(id, plugin, {
                hasWriteAccess: () => this.hasWriteAccess(node.pluginKind),
                onUninstall: async e => {
                    e.stopPropagation();
                    this.extensionsInstaller.uninstall(node.deployed!);
                },
                onReload: () => window.location.reload()
            });
            this.nodes.set(id, node);
            return node;
        }
    }

}

@injectable()
export class LoadingExtensionsNode implements TreeElement {

    @inject(ExtensionNodes)
    protected readonly nodes: ExtensionNodes;

    readonly id = 'loading';

    get visible(): boolean {
        return this.nodes.loading;
    }

    render(): React.ReactNode {
        return <span>Loading...</span>;
    }

}

@injectable()
export class ExtensionsSourceOptions {
    readonly pluginKind: ResolvedPluginKind;
}

export interface ExtensionsAccess {
    hasWriteAccess: () => boolean
    readonly pluginKind: ResolvedPluginKind
    readonly workspaceOwner: UserInfo | undefined
}

@injectable()
export class ExtensionsSource extends TreeSource implements ExtensionsAccess {

    @inject(ExtensionsSourceOptions)
    protected readonly options: ExtensionsSourceOptions;

    @inject(ExtensionNodes)
    protected readonly nodes: ExtensionNodes;

    @inject(LoadingExtensionsNode)
    protected readonly loadingNode: LoadingExtensionsNode;

    @postConstruct()
    protected async init(): Promise<void> {
        this.fireDidChange();
        this.toDispose.push(this.nodes.onDidChange(() => this.fireDidChange()));
    }

    get empty(): boolean {
        return this.nodes.isEmpty(this.pluginKind);
    }

    *getElements(): IterableIterator<TreeElement> {
        yield this.loadingNode;
        for (const pluginNode of this.nodes.getNodes(this.pluginKind)) {
            yield pluginNode;
        }
    }

    hasWriteAccess(): boolean {
        return this.nodes.hasWriteAccess(this.pluginKind);
    }

    get pluginKind(): ResolvedPluginKind {
        return this.options.pluginKind;
    }

    get workspaceOwner(): UserInfo | undefined {
        return this.nodes.workspaceOwner
    }

}

export namespace ExtensionNode {
    export interface Props {
        hasWriteAccess: () => boolean
        onUninstall: (e: React.MouseEvent) => void
        onReload: (e: React.MouseEvent) => void
    }
}
export class ExtensionNode implements TreeElement {

    installed = false;
    deployed: DeployedPlugin | undefined

    constructor(
        public readonly id: string,
        public plugin: PluginMetadata,
        private readonly props: ExtensionNode.Props
    ) { }

    get visible(): boolean {
        return !!this.deployed;
    }

    get pluginKind(): ResolvedPluginKind | undefined {
        return this.deployed && this.deployed.kind;
    }

    render(): React.ReactNode {
        const { plugin } = this;
        let { icon, author, publisher, name, displayName } = plugin.model as GitpodPluginModel;
        if (typeof author === 'object' && 'name' in author) {
            author = author['name'];
        }
        if (typeof author === 'string') {
            publisher = author;
        }
        if (!displayName) {
            displayName = name;
        }
        const iconStyle: React.CSSProperties = {};
        if (icon) {
            iconStyle.backgroundImage = `url('hostedPlugin/${getPluginId(plugin.model)}/${encodeURIComponent(icon)}')`;
        }
        return <div className='gitpod-extension'>
            <div className='gitpod-extension-icon' style={iconStyle} />
            <div className='gitpod-extension-content'>
                <div><span className='gitpod-extension-ellipsis gitpod-extension-name'>{displayName}</span> <span className='gitpod-extension-version'>{plugin.model.version}</span></div>
                <div className='gitpod-extension-ellipsis gitpod-extension-description'>{plugin.model.description}</div>
                <div className='gitpod-extension-action-bar'>
                    <span className='gitpod-extension-ellipsis gitpod-extension-publisher'>{publisher}</span>
                    {this.renderAction()}
                </div>
            </div>
        </div >
    }

    protected renderAction(): React.ReactNode {
        if (!this.props.hasWriteAccess()) {
            return null;
        }
        if (!this.installed) {
            return <button className="theia-button gitpod-extension-action" title='reload window to uninstall' onClick={this.props.onReload}>Reload</button>;
        }
        return <button className="theia-button gitpod-extension-action" onClick={this.props.onUninstall}>Uninstall</button>;
    }

}