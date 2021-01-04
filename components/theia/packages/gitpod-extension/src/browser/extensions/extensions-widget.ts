/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as React from 'react';
import { injectable, inject, interfaces, postConstruct } from 'inversify';
import { Message } from '@phosphor/messaging';
import URI from '@theia/core/lib/common/uri';
import { FileUploadService } from '@theia/filesystem/lib/browser/file-upload-service';
import { SourceTreeWidget } from '@theia/core/lib/browser/source-tree/source-tree-widget';
import { GitpodPluginService } from '../../common/gitpod-plugin-service';
import { TreeNode, NodeProps } from '@theia/core/lib/browser/tree';
import { Deferred } from '@theia/core/lib/common/promise-util';
import { ExtensionsSourceOptions, ExtensionsSource } from './extensions-source';
import { ResolvedPluginKind } from '@gitpod/gitpod-protocol';
import { GitpodInfoService } from '../../common/gitpod-info';
import { ExtensionsInstaller } from './extensions-installer';

@injectable()
export class ExtensionsWidget extends SourceTreeWidget {

    static FACTORY_ID = 'gitpod-extensions';
    static ID = (pluginKind: ResolvedPluginKind) => `gitpod-${pluginKind}-extensions`;
    static createWidget(parent: interfaces.Container, options: ExtensionsSourceOptions): ExtensionsWidget {
        const child = SourceTreeWidget.createContainer(parent, {
            virtualized: false,
            scrollIfActive: true
        });
        child.bind(ExtensionsSourceOptions).toConstantValue(options);
        child.bind(ExtensionsSource).toSelf();
        child.unbind(SourceTreeWidget);
        child.bind(ExtensionsWidget).toSelf();
        return child.get(ExtensionsWidget);
    }

    @inject(ExtensionsSource)
    protected readonly pluginTreeSource: ExtensionsSource;

    @inject(GitpodPluginService)
    protected readonly pluginService: GitpodPluginService;

    @inject(ExtensionsInstaller)
    protected readonly extensionsInstaller: ExtensionsInstaller;

    @inject(FileUploadService)
    protected readonly uploadService: FileUploadService;

    @inject(GitpodInfoService)
    protected readonly infoProvider: GitpodInfoService;

    protected readonly targetUri = new Deferred<URI>();

    @postConstruct()
    protected async init(): Promise<void> {
        super.init();
        this.addClass('gitpod-extensions-view');
        this.id = ExtensionsWidget.ID(this.pluginTreeSource.pluginKind);
        this.title.iconClass = 'gitpod-extensions-view-icon';
        this.updateTitle();

        this.toDispose.push(this.pluginTreeSource);
        this.source = this.pluginTreeSource;
        await this.model.refresh();

        this.pluginService.getUploadUri().then(uri => this.targetUri.resolve(new URI(uri)), this.targetUri.reject);
    }

    get empty(): boolean {
        return this.pluginTreeSource.empty;
    }

    get pluginKind(): ResolvedPluginKind {
        return this.pluginTreeSource.pluginKind;
    }

    protected async updateTitle(): Promise<void> {
        let label: string;
        const { pluginKind } = this.pluginTreeSource;
        if (pluginKind === 'workspace') {
            label = 'Installed for this project';
        } else if (pluginKind === 'user') {
            label = 'Installed for workspace owner';
        } else if (pluginKind === 'builtin') {
            label = 'Built-in'
        } else {
            throw new Error('Unexpected plugin kind: ' + pluginKind);
        }
        this.title.label = label;
        this.title.caption = label;
    }

    protected onUpdateRequest(msg: Message): void {
        if (this.pluginTreeSource.pluginKind === 'user') {
            const owner = this.pluginTreeSource.workspaceOwner;
            const ownerName = owner && owner.name;
            if (ownerName) {
                const label = `Installed for ${ownerName}`;
                this.title.label = label;
                this.title.caption = label;
            }
        }
        super.onUpdateRequest(msg);
    }

    protected onAfterAttach(msg: Message): void {
        super.onAfterAttach(msg);
        this.update();
        this.toDisposeOnDetach.push(this.pluginTreeSource.onDidChange(() => this.update()));

        if (this.pluginTreeSource.pluginKind === 'builtin') {
            return;
        }
        const onDragListener = (e: DragEvent) => {
            if (!this.pluginTreeSource.hasWriteAccess()) {
                return;
            }
            e.preventDefault();
            e.stopPropagation();
            if (e.dataTransfer) {
                e.dataTransfer.dropEffect = 'copy';
            }
        }
        this.addEventListener(this.node, 'dragenter', onDragListener);
        this.addEventListener(this.node, 'dragover', onDragListener);
        this.addEventListener(this.node, 'drop', async e => {
            if (!this.pluginTreeSource.hasWriteAccess() || !e.dataTransfer) {
                return;
            }
            e.preventDefault();
            e.stopPropagation();

            this.upload(e.dataTransfer);
        });
    }

    protected async upload(source?: DataTransfer): Promise<void> {
        if (!this.pluginTreeSource.hasWriteAccess()) {
            return;
        }
        try {
            const targetUri = await this.targetUri.promise;
            const { uploaded } = await this.uploadService.upload(targetUri, {
                source,
                progress: { text: 'Uploading extensions...' }
            });
            this.extensionsInstaller.install(uploaded, this.pluginTreeSource.pluginKind);
        } catch (err) {
            console.error('Failed to install extension', err);
        }
    }

    protected getDefaultNodeStyle(node: TreeNode, props: NodeProps): React.CSSProperties | undefined {
        const style = super.getDefaultNodeStyle(node, props);
        if (style) {
            style.paddingLeft = `${this.props.leftPadding}px`;
        }
        return style;
    }

}