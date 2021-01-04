/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as React from 'react';
import { CommentFormView } from '../comment-form';
import { ReviewComment, ReviewCommentFormContext, ReviewConversation } from '../review-conversation';
import { GitHubEditorModel } from "./github-editor-model";

export class ReviewCommentFormView extends React.Component<ReviewCommentFormView.Props> {
    render(): JSX.Element {
        return <CommentFormView gitHub={this.props.model.gitHub} form={this.props.context.form} renderActions={this.renderActions} />
    }
    protected readonly renderActions = ({ Actions, Submit, Cancel }: CommentFormView.RenderActionsProps) => {
        const { context } = this.props;
        if (context instanceof ReviewComment) {
            return <Actions>
                <Cancel />
                <Submit onClick={this.update}>Update comment</Submit>
            </Actions>;
        }
        if (this.isPending(context)) {
            return <Actions>
                <Cancel />
                <Submit onClick={this.addReviewComment}>Add review comment</Submit>
            </Actions>
        }
        return <Actions>
            <Cancel />
            <Submit onClick={this.addSingleComment}>Add single comment</Submit>
            <Submit onClick={this.startReview}>Start a review</Submit>
        </Actions>
    }

    protected readonly update = () => this.props.context instanceof ReviewComment && this.props.context.update();

    protected readonly addReviewComment = () => this.isPending(this.props.context) && this.props.context.addReviewComment(this.props.model.kind);
    protected isPending(context: ReviewCommentFormContext): context is ReviewConversation {
        return this.props.context instanceof ReviewConversation && !!this.props.model.gitHub.pendingPullRequestReview;
    }

    protected readonly addSingleComment = () => this.isNew(this.props.context) && this.props.context.addSingleComment(this.props.model.kind);
    protected readonly startReview = () => this.isNew(this.props.context) && this.props.context.startReview(this.props.model.kind);
    protected isNew(context: ReviewCommentFormContext): context is ReviewConversation {
        return this.props.context instanceof ReviewConversation && !this.props.model.gitHub.pendingPullRequestReview;
    }

}
export namespace ReviewCommentFormView {
    export interface Props {
        model: GitHubEditorModel
        context: ReviewCommentFormContext
    }
}
