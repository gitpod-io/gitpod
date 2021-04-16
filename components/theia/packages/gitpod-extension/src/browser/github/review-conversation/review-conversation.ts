/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Emitter, Event } from "@theia/core";
import { Marker } from "@theia/markers/lib/common/marker";
import { PullRequestReviewComment, GitHubModel, GitHubFile, AddPendingPullRequestReviewCommentParams } from "../github-model";
import { CommentForm } from "../comment-form";

export interface ReviewConversationMarker extends Marker<ReviewConversation> {
    kind: typeof ReviewConversationMarker.kind
}
export namespace ReviewConversationMarker {
    export const kind = 'review-conversation';
    export function is(marker: Marker<Object>): marker is ReviewConversationMarker {
        return marker.kind === kind;
    }
}

export class ReviewConversation {

    constructor(
        readonly path: string,
        /**
         * A line number in the PR.
         */
        readonly lineNumber: number,
        readonly operation: PullRequestReviewComment.DiffOperation,
        readonly originalLineNumber: number | undefined,
        readonly comments: ReadonlyArray<ReviewComment>,
        readonly form: CommentForm,
        protected readonly gitHub: GitHubModel
    ) { }

    get inReplyTo(): Readonly<PullRequestReviewComment> | undefined {
        const comment = this.comments[this.comments.length - 1]
        return comment ? comment.raw : undefined;
    }

    protected getDiffPosition(kind: GitHubFile.Kind): number | undefined {
        if (kind === 'modified') {
            return this.gitHub.getDiffPosition(kind, this.path, this.lineNumber);
        }
        const originalPath = this.gitHub.getOriginalPath(this.path);
        return originalPath ? this.gitHub.getDiffPosition(kind, originalPath, this.lineNumber) : undefined;
    }

    protected getCommentParams(kind: GitHubFile.Kind, body: string): AddPendingPullRequestReviewCommentParams {
        const { inReplyTo, path } = this;
        if (inReplyTo) {
            return { body, to: inReplyTo };
        }
        const diffPosition = this.getDiffPosition(kind);
        if (!diffPosition) {
            throw new Error(`The diff position is undefined for '${path}' ('${kind}', ${this.lineNumber}).`);
        }
        return {
            body, diffPosition, path
        };
    }

    addSingleComment(kind: GitHubFile.Kind): Promise<void> {
        return this.form.submit(body => this.gitHub.addSinglePullRequestReviewComment(this.getCommentParams(kind, body)));
    }
    startReview(kind: GitHubFile.Kind): Promise<void> {
        return this.form.submit(body => this.gitHub.startPullRequestReview(this.getCommentParams(kind, body)));
    }
    addReviewComment(kind: GitHubFile.Kind): Promise<void> {
        return this.form.submit(body => this.gitHub.addPendingPullRequestReviewComment(this.getCommentParams(kind, body)));
    }

}

export class ReviewComment {

    protected readonly onRevealEmitter = new Emitter<void>();
    readonly onReveal: Event<void> = this.onRevealEmitter.event;

    constructor(
        readonly lineNumber: number,
        readonly operation: PullRequestReviewComment.DiffOperation,
        readonly raw: Readonly<PullRequestReviewComment>,
        readonly form: CommentForm,
        protected readonly gitHub: GitHubModel
    ) { }

    update(): Promise<void> {
        return this.form.submit(body => this.gitHub.updatePullRequestReviewComment({
            body,
            comment: this.raw
        }));
    }

    delete(): Promise<void> {
        return this.gitHub.deletePullRequestReviewComment({
            comment: this.raw
        });
    }

    reveal(): void {
        this.onRevealEmitter.fire(undefined);
    }

}

export type ReviewCommentFormContext = ReviewConversation | ReviewComment;