/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject, postConstruct } from "inversify";
import URI from "@theia/core/lib/common/uri";
import { EditorManager, EditorWidget } from "@theia/editor/lib/browser";
import { MonacoEditor } from "@theia/monaco/lib/browser/monaco-editor";
import { MonacoDiffEditor } from "@theia/monaco/lib/browser/monaco-diff-editor";
import { GitDiffContribution } from "@theia/git/lib/browser/diff/git-diff-contribution";
import { GitHubModel, PullRequestReviewComment } from "../github-model";
import { GitHubEditorServiceFactory, GitHubEditorService } from "./github-editor-service";
import { GitHubEditorWidget } from "./github-editor-widget";
import { GitHosterModel } from "../../githoster/model/githoster-model";
import { github } from "../github-decorators";

@injectable()
export class GitHubEditorManager {

    readonly id = "github-editor-widget";

    @inject(GitHosterModel) @github
    protected readonly gitHub: GitHubModel;

    @inject(GitDiffContribution)
    protected readonly gitDiff: GitDiffContribution;

    @inject(EditorManager)
    protected readonly editorManager: EditorManager;

    @inject(GitHubEditorServiceFactory)
    protected readonly createEditorService: GitHubEditorServiceFactory;

    @postConstruct()
    protected init() {
        this.editorManager.onCreated(editor => this.addEditorWidget(editor));
    }

    async open(uri: URI, lineNumber: number, operation: PullRequestReviewComment.DiffOperation): Promise<GitHubEditorWidget | undefined> {
        const diffOptions = await this.gitHub.getDiffOptions();
        const diffView = await this.gitDiff.widget;
        await diffView.setContent(diffOptions);
        const editor = await diffView.openChanges(uri, { mode: 'reveal' });
        if (editor) {
            const widget = this.getEditorWidget(editor, lineNumber, operation);
            if (widget) {
                widget.show();
            }
            return widget;
        }
        return undefined;
    }

    protected async addEditorWidget(widget: EditorWidget): Promise<void> {
        const monacoEditor = MonacoEditor.get(widget);
        if (monacoEditor instanceof MonacoDiffEditor) {
            const diffEditor = monacoEditor.diffEditor;
            this.addEditor(diffEditor.getOriginalEditor(), diffEditor);
            this.addEditor(diffEditor.getModifiedEditor(), diffEditor);
        } else if (monacoEditor) {
            this.addEditor(monacoEditor.getControl());
        }
    }

    protected readonly services = new Map<monaco.editor.IStandaloneCodeEditor, GitHubEditorService>();
    protected async addEditor(editor: monaco.editor.IStandaloneCodeEditor, diffEditor?: monaco.editor.IStandaloneDiffEditor): Promise<void> {
        // FIXME skip embedded editors, like find references
        await new Promise(resolve => {
            const toDispose = editor.onDidLayoutChange(value => {
                toDispose.dispose();
                resolve(value);
            });
        });
        const service = this.createEditorService({ editor, diffEditor });
        this.services.set(editor, service);
        editor.onDidDispose(() => this.services.delete(editor));
        service.render();
    }

    get editorWidgets(): GitHubEditorWidget[] {
        const editorService = this.editorService;
        return editorService ? editorService.widgets : [];
    }

    get editorWidget(): GitHubEditorWidget | undefined {
        const editorService = this.editorService;
        return editorService && editorService.widget;
    }

    protected getEditorWidget(editor: EditorWidget | undefined, lineNumber: number, operation: PullRequestReviewComment.DiffOperation): GitHubEditorWidget | undefined {
        const service = this.getEditorService(editor, operation);
        return service && service.getWidget(lineNumber)
    }

    protected get editorService(): GitHubEditorService | undefined {
        return this.getEditorService(this.editorManager.currentEditor);
    }

    protected getEditorService(editor: EditorWidget | undefined, operation: PullRequestReviewComment.DiffOperation = ' '): GitHubEditorService | undefined {
        if (operation === '-') {
            return this.getOriginalEditorService(editor);
        }
        if (operation === '+') {
            return this.getModifiedEditorService(editor);
        }
        const originalService = this.getOriginalEditorService(editor);
        if (originalService && originalService.editor.hasTextFocus()) {
            return originalService;
        }
        return this.getModifiedEditorService(editor);
    }

    protected getOriginalEditorService(editor: EditorWidget | undefined): GitHubEditorService | undefined {
        const monacoEditor = MonacoEditor.get(editor);
        if (monacoEditor instanceof MonacoDiffEditor) {
            const originalEditor = monacoEditor.diffEditor.getOriginalEditor();
            return this.services.get(originalEditor);
        }
        return undefined;
    }

    protected getModifiedEditorService(editor: EditorWidget | undefined): GitHubEditorService | undefined {
        const monacoEditor = MonacoEditor.get(editor);
        return monacoEditor && this.services.get(monacoEditor.getControl());
    }

}
