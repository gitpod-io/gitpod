/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { DisposableCollection, Disposable, Emitter, Event } from "@theia/core";
import { GitHubModel } from "../github-model";
import { GIT_RESOURCE_SCHEME } from "@theia/git/lib/browser/git-resource";
import { MonacoTextModelService } from "@theia/monaco/lib/browser/monaco-text-model-service";
import { GitHubEditorLineMapper } from "./github-editor-line-mapper";

import debounce = require('lodash.debounce');

export class GitHubEditorChangeTracker implements Disposable, GitHubEditorLineMapper.Model {

    protected readonly toDispose = new DisposableCollection();
    protected readonly onChangedEmitter = new Emitter<void>();
    readonly onChanged: Event<void> = this.onChangedEmitter.event;

    constructor(
        protected readonly gitHub: GitHubModel,
        protected readonly editor: monaco.editor.ICodeEditor,
        protected readonly models: MonacoTextModelService
    ) {
        this.toDispose.push(gitHub.onDidChange(() => this.update()));
        this.toDispose.push(editor.onDidChangeModelContent(() => this.updateDirtyDiff()));
        this.update()
    }

    dispose(): void {
        this.toDispose.dispose();
    }

    protected sha: string | undefined;
    protected toDisposeOnUpdate = new DisposableCollection();
    protected async update(): Promise<void> {
        const sha = this.gitHub.lastCommit && this.gitHub.lastCommit.sha;
        if (this.sha === sha) {
            return;
        }
        this.sha = sha;
        this.toDisposeOnUpdate.dispose();
        if (sha) {
            const model = this.editor.getModel();
            if (model !== null) {
                this.modifiedUri = model.uri;
                this.toDisposeOnUpdate.push(Disposable.create(() => this.modifiedUri = undefined));

                this.originalUri = this.modifiedUri.with({ scheme: GIT_RESOURCE_SCHEME, query: sha });
                this.toDisposeOnUpdate.push(Disposable.create(() => this.originalUri = undefined));

                const reference = await this.models.createModelReference(this.originalUri);
                this.toDisposeOnUpdate.push(reference);
                if (this.toDispose.disposed) {
                    this.toDisposeOnUpdate.dispose();
                    return;
                }
                this.toDispose.push(this.toDisposeOnUpdate);
            }
        }
        this.updateDirtyDiff();
    }


    protected _changes: monaco.services.IChange[] | undefined;
    get changes(): monaco.services.IChange[] | undefined {
        return this._changes;
    }

    protected readonly updateDirtyDiff = debounce(() => this.doUpdateDirtyDiff(), 50);
    protected async doUpdateDirtyDiff(): Promise<void> {
        this._changes = await this.computeDirtyDiff();
        this.onChangedEmitter.fire(undefined);
    }

    protected originalUri: monaco.Uri | undefined;
    protected modifiedUri: monaco.Uri | undefined;
    protected async computeDirtyDiff(): Promise<monaco.services.IChange[] | undefined> {
        const { originalUri, modifiedUri } = this;
        if (!originalUri || !modifiedUri) {
            return undefined;
        }
        const editorWorkerService = monaco.services.StaticServices.editorWorkerService.get();
        if (editorWorkerService.canComputeDirtyDiff(originalUri, modifiedUri)) {
            return editorWorkerService.computeDirtyDiff(originalUri, modifiedUri, false);
        }
        return undefined;
    }

}
