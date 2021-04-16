/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as React from 'react';
import * as semver from 'semver';
import { injectable, inject } from 'inversify';
import { QuickPickService } from '@theia/core/lib/browser';
import { VSXExtension, VSXExtensionEditorComponent, VSXExtensionData, VSXExtensionComponent, AbstractVSXExtensionComponent } from '@theia/vsx-registry/lib/browser/vsx-extension';
import { ResolvedPluginKind } from '@gitpod/gitpod-protocol';
import { ExtensionsInstaller } from './extensions-installer';
import { DeployedPlugin } from '../../common/gitpod-plugin-service';
import { GitpodPluginData } from './gitpod-plugin-support';
import { ExtensionNodes } from './extensions-source';

@injectable()
export class GitpodVSXExtension extends VSXExtension {

    @inject(ExtensionNodes)
    protected readonly extensionNodes: ExtensionNodes;

    @inject(ExtensionsInstaller)
    protected readonly extensionsInstaller: ExtensionsInstaller;

    @inject(QuickPickService)
    protected readonly quickPickService: QuickPickService;

    private _currentAction?: 'install' | 'uninstall' | 'update';
    get currentAction() {
        return this._currentAction;
    }

    get deployedPlugin(): DeployedPlugin | undefined {
        const data: GitpodPluginData = this.pluginSupport as any;
        return data.deployed[this.id];
    }

    get outdated(): boolean {
        const plugin = this.plugin;
        if (plugin) {
            const model = plugin.metadata.model;
            const publishedVersion = this.data.version;
            if (model && publishedVersion) {
                return semver.lt(model.version, publishedVersion);
            }
        }
        return false;
    }

    protected getData<K extends keyof VSXExtensionData>(key: K): VSXExtensionData[K] {
        // Always display the data received from the registry, not the deployed data
        return this.data[key];
    }

    async install(): Promise<void> {
        this._busy++;
        this._currentAction = 'install';
        try {
            const extName = this.displayName || this.name || this.id;
            const owner = this.extensionNodes.workspaceOwner;
            const selection = await this.quickPickService.show<ResolvedPluginKind>([
                {
                    value: 'workspace',
                    label: 'Install for this project',
                    detail: `${extName} is added to the workspace configuration of this project.`
                },
                {
                    value: 'user',
                    label: `Install for ${owner && owner.name ? owner.name : 'workspace owner'}`,
                    detail: `${extName} will be available in all your workspaces.`
                }
            ]);
            if (selection) {
                await this.extensionsInstaller.downloadAndInstall(this.id, this.version, selection);
            }
        } catch (err) {
            console.error(err.message);
        } finally {
            this._currentAction = undefined;
            this._busy--;
        }
    }

    async uninstall(): Promise<void> {
        this._busy++;
        this._currentAction = 'uninstall';
        try {
            const deployed = this.deployedPlugin;
            if (!deployed) {
                throw new Error(`Plugin ${this.id} was not deployed.`);
            }
            await this.extensionsInstaller.uninstall(deployed);
        } catch (err) {
            console.error(err.message);
        } finally {
            this._currentAction = undefined;
            this._busy--;
        }
    }

    async updateVersion(): Promise<void> {
        this._busy++;
        this._currentAction = 'update';
        try {
            const deployed = this.deployedPlugin;
            if (!deployed) {
                throw new Error(`Plugin ${this.id} was not deployed.`);
            }
            await this.extensionsInstaller.updateVersion(deployed, this.id, this.data.version);
        } catch (err) {
            console.error(err.message);
        } finally {
            this._currentAction = undefined;
            this._busy--;
        }
    }

    render(): React.ReactNode {
        return <GitpodExtensionComponent extension={this} />;
    }

    renderEditor(): React.ReactNode {
        return <GitpodExtensionEditorComponent extension={this} />;
    }

}

class GitpodExtensionComponent extends VSXExtensionComponent {
    protected renderAction(): React.ReactNode {
        return renderAction(this);
    }
}

class GitpodExtensionEditorComponent extends VSXExtensionEditorComponent {
    protected renderAction(): React.ReactNode {
        return renderAction(this);
    }
}

const renderAction = (component: AbstractVSXExtensionComponent) => {
    const ext = component.props.extension as GitpodVSXExtension;
    const deployed = ext.deployedPlugin;
    if (deployed && deployed.kind === 'builtin') {
        return <button className='theia-button action theia-mod-disabled'>Built-in</button>;
    }
    const ellipsis = component instanceof VSXExtensionEditorComponent ? '...' : '';
    if (ext.busy) {
        switch (ext.currentAction) {
            case 'uninstall':
                return <button className='theia-button action theia-mod-disabled'>Uninstalling</button>;
            case 'install':
                return <button className='theia-button action prominent theia-mod-disabled'>Installing{ellipsis}</button>;
            case 'update':
                return <button className='theia-button action prominent theia-mod-disabled'>Updating</button>;
            default:
                return null;
        }
    }
    if (ext.installed) {
        const uninstall = <button className='theia-button action'
            title={deployed ? `Installed for ${deployed.kind}` : undefined}
            onClick={component.uninstall.bind(component)}>Uninstall</button>;
        if (ext.outdated) {
            return <div className='theia-vsx-extension-action-bar'>
                {uninstall}
                <button className='theia-button prominent action'
                    title={`Update to version ${ext.version}`}
                    onClick={() => updateVersion(ext, component)}>Update</button>
            </div>
        } else {
            return uninstall;
        }
    }
    return <button className='theia-button prominent action'
        title={`Install ${ext.id} version ${ext.version || 'unknown'}`}
        onClick={component.install.bind(component)}>Install{ellipsis}</button>;
}

const updateVersion = async (extension: GitpodVSXExtension, component: AbstractVSXExtensionComponent) => {
    try {
        const pending = extension.updateVersion();
        component.forceUpdate();
        await pending;
    } finally {
        component.forceUpdate();
    }
}
