/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject } from "inversify";
import URI from "@theia/core/lib/common/uri";
import { DisposableCollection, Disposable } from "@theia/core";
import { MonacoTextModelService } from "@theia/monaco/lib/browser/monaco-text-model-service";
import { GitHubModel, GitHubFile } from "../github-model";
import { GitHubAnimationFrame } from "../github-animation-frame";
import { GitHubEditorModel } from "./github-editor-model";
import { GitHubEditorDecoration } from "./github-editor-decoration";
import { GitHubEditorWidget } from "./github-editor-widget";
import { ReviewConversationManager } from "../review-conversation";
import { GitHubEditorChangeTracker } from "./github-editor-change-tracker";
import { GitHubEditorLineMapper } from "./github-editor-line-mapper";
import { GitHosterModel } from "../../githoster/model/githoster-model";
import { github } from "../github-decorators";

@injectable()
export class GitHubEditorServiceOptions {
    readonly editor: monaco.editor.IStandaloneCodeEditor
    readonly diffEditor?: monaco.editor.IStandaloneDiffEditor
}

export const GitHubEditorServiceFactory = Symbol('GitHubEditorServiceFactory');
export type GitHubEditorServiceFactory = (options: GitHubEditorServiceOptions) => GitHubEditorService;

@injectable()
export class GitHubEditorService {

    readonly editor: monaco.editor.ICodeEditor;
    readonly diffEditor?: monaco.editor.IStandaloneDiffEditor;
    protected readonly toDispose = new DisposableCollection();
    protected readonly toDisposeOnDidChangeModel = new DisposableCollection();

    protected readonly _widgets = new Map<number, GitHubEditorWidget>();
    protected readonly toDisposeWidgets = new DisposableCollection();

    protected newConversationDecorations: string[] = [];

    protected readonly lineMapper: GitHubEditorLineMapper;

    constructor(
        @inject(GitHosterModel) @github protected readonly gitHub: GitHubModel,
        @inject(GitHubAnimationFrame) protected readonly frame: GitHubAnimationFrame,
        @inject(ReviewConversationManager) readonly conversations: ReviewConversationManager,
        @inject(GitHubEditorServiceOptions) protected readonly options: GitHubEditorServiceOptions,
        @inject(MonacoTextModelService) protected readonly models: MonacoTextModelService
    ) {
        this.editor = options.editor;
        this.diffEditor = options.diffEditor;
        this.editor.onDidDispose(() => this.dispose());

        const changeTracker = new GitHubEditorChangeTracker(gitHub, options.editor, models);
        this.toDispose.push(changeTracker.onChanged(() => this.render()));
        this.toDispose.push(changeTracker);
        this.lineMapper = new GitHubEditorLineMapper(changeTracker);

        this.toDispose.push(this.toDisposeOnDidChangeModel);
        this.toDisposeOnDidChangeModel.push(this.toDisposeWidgets);
        this.toDispose.push(this.editor.onDidChangeModel(() => {
            this.toDisposeOnDidChangeModel.dispose();
            this.toDispose.push(this.toDisposeOnDidChangeModel);
            this.toDisposeOnDidChangeModel.push(this.toDisposeWidgets);
            this.render();
        }));

        this.toDispose.push(this.conversations.onDidChangeMarkers(uri => {
            const changedPath = this.gitHub.getPath(uri);
            if (!!changedPath && changedPath === this.path) {
                this.render();
            }
        }));
        this.toDispose.push(this.onDidChangeRenderSideBySide(() => this.render()));

        this.toDispose.push(this.editor.onMouseDown(e => this.triggerConversationDecoration(e)));
        this.toDispose.push(this.editor.onMouseMove(e => this.renderNewConversationDecorations(e)));
        this.toDispose.push(this.editor.onMouseLeave(e => this.renderNewConversationDecorations(e)));
        this.toDispose.push(Disposable.create(() => this.editor.deltaDecorations(this.newConversationDecorations, [])));
    }

    dispose(): void {
        this.toDispose.dispose();
    }

    protected renderSideBySide: boolean = true;
    protected onDidChangeRenderSideBySide(cb: () => void): Disposable {
        const diffEditor = this.diffEditor;
        if (!diffEditor) {
            return Disposable.NULL;
        }
        this.renderSideBySide = (diffEditor as any).renderSideBySide;
        const { updateOptions } = diffEditor;
        diffEditor.updateOptions = (newOptions: any) => {
            updateOptions.bind(diffEditor)(newOptions);
            if (newOptions.renderSideBySide !== this.renderSideBySide) {
                this.renderSideBySide = newOptions.renderSideBySide;
                cb();
            }
        }
        return Disposable.create(() => diffEditor.updateOptions = updateOptions);
    }


    protected shouldRender(): boolean {
        const path = this.path;
        if (!path || !this.gitHub.paths.has(path)) {
            return false;
        }
        return this.renderSideBySide || !this.diffEditor || this.diffEditor.getModifiedEditor() === this.editor;
    }
    render(): void {
        if (!this.shouldRender()) {
            this.toDisposeWidgets.dispose();
            this.reservedCommentingSpace.dispose();
            this.toDisposeOnDidChangeModel.push(this.toDisposeWidgets);
            return;
        }
        const path = this.path;
        if (!path) return;

        this.reserveCommentingSpace();

        for (const lineNumber of this.gitHub.getLineNumbers(path)) {
            const widget = this.getOrCreateWidget(path, lineNumber);
            if (widget) {
                widget.render();
            }
        }
    }

    protected readonly reservedCommentingSpace = new DisposableCollection();
    protected reserveCommentingSpace(): void {
        if (!this.reservedCommentingSpace.disposed) {
            return;
        }
        const extraEditorClassName = this.editor.getOption(monaco.editor.EditorOption.extraEditorClassName);
        const lineDecorationsWidth = this.editor.getOption(monaco.editor.EditorOption.layoutInfo).decorationsWidth;
        let commentDecorationWidth = 0;
        if (!this.editor.getOption(monaco.editor.EditorOption.folding)) {
            commentDecorationWidth += 18;
        }
        this.editor.updateOptions({
            lineDecorationsWidth: lineDecorationsWidth + commentDecorationWidth,
            extraEditorClassName: [...extraEditorClassName.split(' '), 'gp-review-editor'].join(' ')
        });
        this.reservedCommentingSpace.push(Disposable.create(() => this.editor.updateOptions({
            lineDecorationsWidth,
            extraEditorClassName
        })));
    }

    protected _path: string | undefined = undefined;
    protected get path(): string | undefined {
        if (this._path === undefined) {
            const model = this.editor.getModel();
            if (!model) return undefined;

            const uri = new URI(model.uri.toString());
            this._path = this.gitHub.getPath(uri);
            this.toDisposeOnDidChangeModel.push(Disposable.create(() => this._path = undefined));
        }
        return this._path;
    }

    protected get kind(): GitHubFile.Kind {
        const editorModel = this.editor.getModel();
        if (editorModel === null) {
            console.error('Editor has no model', this.editor.getId());
            return 'modified';
        }
        return editorModel.uri.scheme === 'file' ? 'modified' : 'original';
    }

    protected getOrCreateWidget(path: string, pullRequestLineNumber: number): GitHubEditorWidget | undefined {
        if (!this.shouldRender()) {
            return undefined;
        }
        const kind = this.kind;
        const position = this.gitHub.getDiffPosition(kind, path, pullRequestLineNumber);
        const modifiedPath = kind === 'modified' ? path : this.gitHub.getModifiedPath(path);
        if (position === undefined || modifiedPath === undefined) {
            return undefined;
        }
        const existing = this._widgets.get(pullRequestLineNumber);
        if (existing) {
            return existing;
        }
        const widget = new GitHubEditorWidget(
            new GitHubEditorModel(kind, modifiedPath, pullRequestLineNumber, this.gitHub, this.conversations, this.lineMapper),
            this.editor, this.frame);
        this.toDisposeWidgets.push(widget);

        this._widgets.set(pullRequestLineNumber, widget);
        this.toDisposeWidgets.push(Disposable.create(() => this._widgets.delete(pullRequestLineNumber)));

        return widget;
    }

    getWidget(pullRequestLineNumber: number): GitHubEditorWidget | undefined {
        const path = this.path;
        if (!path) {
            return undefined;
        }
        return this.getOrCreateWidget(path, pullRequestLineNumber);
    }

    get pullRequestLineNumber(): number {
        const position = this.editor.getPosition();
        if (position === null) {
            return 0;
        }
        const lineNumber = position.lineNumber;
        return this.lineMapper.mapToPullRequest(lineNumber);
    }

    get widget(): GitHubEditorWidget | undefined {
        const pullRequestLineNumber = this.pullRequestLineNumber;
        return this.getWidget(pullRequestLineNumber);
    }

    get widgets(): GitHubEditorWidget[] {
        return Array.from(this._widgets.values());
    }

    protected triggerConversationDecoration(e: monaco.editor.IEditorMouseEvent): void {
        if (!e.event.leftButton
            || e.target.type !== monaco.editor.MouseTargetType.GUTTER_LINE_DECORATIONS
            || e.target.element === null
            || e.target.element.className.indexOf('icon-comment-discussion') === -1) {
            return;
        }
        const widget = this.getWidgetForMouseEvent(e);
        if (!widget) {
            return;
        }
        if (widget.model.enabled) {
            widget.toggle();
        } else {
            widget.startNewConversation();
        }
    }

    protected renderNewConversationDecorations(e: monaco.editor.IPartialEditorMouseEvent): void {
        const decorations: monaco.editor.IModelDeltaDecoration[] = [];
        const widget = this.getWidgetForMouseEvent(e);
        if (widget && !widget.model.enabled) {
            const decoration = GitHubEditorDecoration.createNewConversationDecoration(widget.model.lineNumber);
            if (decoration) {
                decorations.push(decoration);
            }
        }
        this.newConversationDecorations = this.editor.deltaDecorations(this.newConversationDecorations, decorations);
    }

    protected getWidgetForMouseEvent(e: monaco.editor.IPartialEditorMouseEvent): GitHubEditorWidget | undefined {
        if (!this.gitHub.pullRequest || !e.target) {
            return undefined;
        }
        const position = e.target.position;
        if (!position) {
            return undefined;
        }
        const path = this.path;
        if (path === undefined) {
            return undefined;
        }
        const pullRequestLineNumber = this.lineMapper.mapToPullRequest(position.lineNumber);
        return this.getOrCreateWidget(path, pullRequestLineNumber);
    }

}
