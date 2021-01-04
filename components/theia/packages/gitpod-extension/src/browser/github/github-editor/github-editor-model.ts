/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Disposable, DisposableCollection, Emitter, Event } from '@theia/core';
import { GitHubModel, GitHubFile, PullRequestReviewComment } from '../github-model';
import { ReviewConversationManager, ReviewConversation } from '../review-conversation';
import { GitHubEditorLineMapper } from './github-editor-line-mapper';

export class GitHubEditorModel implements Disposable {

    protected readonly toDispose = new DisposableCollection();

    protected readonly onDidChangeEmitter = new Emitter<void>();
    readonly onDidChange: Event<void> = this.onDidChangeEmitter.event;

    readonly newConversation: ReviewConversation;

    constructor(
        readonly kind: GitHubFile.Kind,
        readonly path: string,
        readonly pullRequestLineNumber: number,
        readonly gitHub: GitHubModel,
        readonly conversationManager: ReviewConversationManager,
        readonly lineMapper: GitHubEditorLineMapper
    ) {
        this.toDispose.push(this.onDidChangeEmitter);

        this.newConversation = this.conversationManager.createNewConversation(this.path, this.pullRequestLineNumber, this.operation);
        this.toDispose.push(this.newConversation.form.onDidChange(() => this.fireDidChange()));

        conversationManager.onDidChangeMarkers.maxListeners += 1;
        this.toDispose.push(conversationManager.onDidChangeMarkers(uri => {
            const changedPath = this.gitHub.getPath(uri);
            if (!!changedPath && changedPath === this.path) {
                this.refresh();
            }
        }));
        this.toDispose.push(Disposable.create(() => conversationManager.onDidChangeMarkers.maxListeners -= 1));
        this.refresh();
    }

    get lineNumber(): number {
        return this.lineMapper.mapToChanges(this.pullRequestLineNumber);
    }

    get operation(): PullRequestReviewComment.DiffOperation {
        return this.kind === 'original' ? '-' : '+';
    }

    dispose(): void {
        this.toDispose.dispose();
    }

    get enabled(): boolean {
        return this._conversations.length !== 0 || this.newConversation.form.visible;
    }

    protected _conversations: ReviewConversation[] = [];
    get conversations(): ReadonlyArray<ReviewConversation> {
        return this._conversations;
    }
    protected refresh(): void {
        this._conversations = this.conversationManager.getConversations(this.path, this.pullRequestLineNumber, this.operation);
        this.fireDidChange();
    }
    protected fireDidChange() {
        this.onDidChangeEmitter.fire(undefined);
    }

    renderMarkdown(text: string): Promise<string> {
        return this.gitHub.renderMarkdown(text);
    }

}
