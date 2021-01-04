/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as React from 'react';
import { DisposableCollection } from '@theia/core';
import { GitHubEditorModel } from "./github-editor-model";
import { ReviewCommentFormView } from './review-comment-form-view';
import { ReviewConversation } from '../review-conversation';

export class ReviewConversationReplyView extends React.Component<GitHubEditorComment.Props> {

    protected readonly toDispose = new DisposableCollection();
    componentDidMount(): void {
        const { conversation } = this.props;
        this.toDispose.push(conversation.form.onDidChange(() => this.forceUpdate()));
    }
    componentWillUnmount(): void {
        this.toDispose.dispose();
    }

    render(): JSX.Element {
        const { conversation, model } = this.props;
        return <div className='reply'>
            {conversation.form.visible ?
                <ReviewCommentFormView context={conversation} model={model} /> :
                <button className='reply theia-button' onClick={() => conversation.form.open()}>Reply ...</button>}
        </div >;
    }
}
export namespace GitHubEditorComment {
    export interface Props {
        model: GitHubEditorModel
        conversation: ReviewConversation
    }
}
