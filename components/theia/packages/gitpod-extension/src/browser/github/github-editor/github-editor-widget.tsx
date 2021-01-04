/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Disposable, DisposableCollection } from "@theia/core";
import { GitHubAnimationFrame } from "../github-animation-frame";
import { ReviewConversation } from '../review-conversation';
import { GitHubEditorModel } from "./github-editor-model";
import { GitHubEditorViewZone } from "./github-editor-view-zone";
import { GitHubEditorDecoration } from './github-editor-decoration';
import { ReviewCommentView } from './review-comment-view';
import { ReviewConversationReplyView } from './review-conversation-reply-view';
import { ReviewNewConversationView } from './review-new-conversation-view';

let gitHubEditorWidgetSequence = 0;

export class GitHubEditorWidget implements monaco.editor.IOverlayWidget, Disposable {

    protected readonly id = `GitHubEditorWidget-${gitHubEditorWidgetSequence++}`;
    protected readonly host = document.createElement('div');

    protected decorations: string[] = [];
    protected readonly viewZone = new GitHubEditorViewZone(this.host, this.editor, () => this.model.lineNumber);

    protected readonly toHide = new DisposableCollection();
    protected readonly toDispose = new DisposableCollection();

    constructor(
        readonly model: GitHubEditorModel,
        readonly editor: monaco.editor.ICodeEditor,
        protected readonly frame: GitHubAnimationFrame
    ) {
        this.host.classList.add('github-view');
        this.host.classList.add('github-editor-widget');
        this.toDispose.push(model);
        this.toDispose.push(this.toHide);
        this.toDispose.push(this.model.onDidChange(() => this.render()));
        const editorModel = this.editor.getModel();
        if (editorModel) {
            this.toDispose.push(editorModel.onDidChangeContent(() => this.renderDecorations()));
        } else {
            console.error(`The editor model was null`, this.editor.getId());
        }
        this.toDispose.push(Disposable.create(() => this.editor.deltaDecorations(this.decorations, [])));
        this.toDispose.push((Disposable.create(() => ReactDOM.unmountComponentAtNode(this.host))));
    }

    dispose(): void {
        this.toDispose.dispose();
    }

    getId(): string {
        return this.id;
    }

    getDomNode(): HTMLElement {
        return this.host;
    }

    getPosition(): monaco.editor.IOverlayWidgetPosition {
        return null!;
    }

    startNewConversation(): void {
        this.show();
        this.model.newConversation.form.open();
    }

    toggle(): void {
        if (this.visible) {
            this.hide();
        } else {
            this.show();
        }
    }

    get visible(): boolean {
        return !this.toHide.disposed;
    }

    show(): void {
        if (this.visible) {
            return;
        }
        this.editor.addOverlayWidget(this);
        this.toHide.push(Disposable.create(() => this.editor.removeOverlayWidget(this)));

        this.viewZone.show();
        this.toHide.push(this.viewZone);
        this.toHide.push(this.editor.onDidLayoutChange(info => this.viewZone.layout(info)));
        this.toHide.push(this.model.lineMapper.model.onChanged(() => this.viewZone.layout()));
        this.toHide.push(this.frame.schedule(() => this.viewZone.autoLayout()));
    }

    hide(): void {
        this.toHide.dispose();
        this.toDispose.push(this.toHide);
    }

    render(): void {
        this.renderDecorations();
        this.renderView();
    }

    protected renderDecorations(): void {
        this.decorations = this.editor.deltaDecorations(this.decorations, this.renderConversationDecorations());
    }

    protected renderConversationDecorations(): monaco.editor.IModelDeltaDecoration[] {
        if (!this.model.enabled) {
            return [];
        }
        const decoration = GitHubEditorDecoration.createConversationDecoration(this.model.lineNumber);
        if (!decoration) {
            return [];
        }
        return [decoration];
    }

    protected renderView(): void {
        if (this.model.enabled) {
            const conversations = this.renderConversations();
            ReactDOM.render(conversations, this.host);
        } else {
            this.hide();
        }
    }

    protected renderConversations(): JSX.Element[] {
        const children = this.model.conversations.map(
            conversation => this.renderConversation(conversation)
        );
        children.push(<ReviewNewConversationView key="new" model={this.model} />);
        return children;
    }

    protected renderConversation(conversation: ReviewConversation): JSX.Element {
        return <div key={conversation.comments[0].raw.id} className='conversation-panel'>
            {conversation.comments.map(
                comment => <ReviewCommentView key={comment.raw.id} model={this.model} editor={this.editor} comment={comment} />
            )}
            <ReviewConversationReplyView key="reply" model={this.model} conversation={conversation} />
        </div>;
    }

}
