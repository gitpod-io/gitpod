/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject, postConstruct } from "inversify";
import URI from "@theia/core/lib/common/uri";
import { MarkerManager } from "@theia/markers/lib/browser";
import { GitHubModel, GitHubData, PullRequestReviewComment } from "../github-model";
import { CommentForm } from "../comment-form";
import { ReviewConversationMarker, ReviewConversation, ReviewComment } from "./review-conversation";
import { GitHosterModel } from "../../githoster/model/githoster-model";
import { github } from "../github-decorators";

@injectable()
export class ReviewConversationManager extends MarkerManager<ReviewConversation> {

    protected readonly owner = 'default';

    @inject(GitHosterModel) @github
    protected readonly gitHub: GitHubModel;

    @postConstruct()
    protected init(): void {
        super.init();
        this.gitHub.onDidChange(() => this.updateMarkers());
        this.updateMarkers();
    }

    getKind(): string {
        return ReviewConversationMarker.kind;
    }

    updateMarkers(): void {
        const deleted = new Set(this.getUris());
        for (const path of this.gitHub.paths) {
            const uri = this.gitHub.getUri(path);
            if (uri) {
                const conversations: ReviewConversation[] = [];
                for (const lineNumber of this.gitHub.getLineNumbers(path)) {
                    const lineConversations = this.createConversations(path, lineNumber);
                    conversations.push(...lineConversations);
                }
                if (conversations.length > 0) {
                    deleted.delete(uri.toString());
                    this.setMarkers(uri, this.owner, conversations);
                }
            }
        }
        for (const uri of deleted) {
            this.setMarkers(new URI(uri), this.owner, []);
        }
    }

    getConversations(path: string, lineNumber: number, operation?: PullRequestReviewComment.DiffOperation): ReviewConversation[] {
        const uri = this.gitHub.getUri(path);
        return uri ? this.findMarkers({
            uri,
            dataFilter: conversation => {
                if (operation === undefined || conversation.operation === operation) {
                    return conversation.lineNumber === lineNumber;
                }
                if (operation === '-') {
                    return conversation.originalLineNumber === lineNumber;
                }
                return conversation.operation === ' ' && conversation.lineNumber === lineNumber;
            }
        }).map(m => m.data) : [];
    }

    createNewConversation(path: string, lineNumber: number, operation: PullRequestReviewComment.DiffOperation): ReviewConversation {
        return new ReviewConversation(path, lineNumber, operation, undefined, [], new CommentForm(), this.gitHub);
    }

    protected createConversations(path: string, lineNumber: number): ReviewConversation[] {
        const conversations = this.getConversations(path, lineNumber);
        return this.gitHub.getLineConversations(path, lineNumber).map(
            (conversation, index) => {
                return this.createConversation(path, lineNumber, conversation, conversations[index]);
            }
        );
    }
    protected createConversation(path: string, lineNumber: number, raw: GitHubData.Conversation, existing?: ReviewConversation): ReviewConversation {
        const comments = this.createComments(lineNumber, raw.comments, raw.operation, existing ? existing.comments : []);
        const form = existing ? existing.form : new CommentForm();
        return new ReviewConversation(path, lineNumber, raw.operation, raw.originalLineNumber, comments, form, this.gitHub);
    }
    protected createComments(lineNumber: number, comments: ReadonlyArray<PullRequestReviewComment>, operation: PullRequestReviewComment.DiffOperation, existing: ReadonlyArray<ReviewComment>): ReadonlyArray<ReviewComment> {
        return comments.map((raw, index) =>
            this.createComment(lineNumber, raw, operation, existing[index])
        );
    }
    protected createComment(lineNumber: number, raw: PullRequestReviewComment, operation: PullRequestReviewComment.DiffOperation, existing?: ReviewComment): ReviewComment {
        const form = existing ? existing.form : new CommentForm({ defaultBody: raw.body });
        return new ReviewComment(lineNumber, operation, raw, form, this.gitHub);
    }

    protected getStorageKey(): undefined {
        return undefined;
    }

}