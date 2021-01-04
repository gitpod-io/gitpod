/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as React from 'react';
import { DisposableCollection } from '@theia/core';
import { GitHubEditorModel } from "./github-editor-model";
import { ReviewCommentFormView } from './review-comment-form-view';

export class ReviewNewConversationView extends React.Component<GitHubEditorComment.Props> {

    protected readonly toDispose = new DisposableCollection();
    componentDidMount(): void {
        const { model } = this.props;
        this.toDispose.push(model.newConversation.form.onDidChange(() => this.forceUpdate()));
    }
    componentWillUnmount(): void {
        this.toDispose.dispose();
    }

    render(): JSX.Element {
        const { model } = this.props;
        return <div className='new-conversation'>
            {model.newConversation.form.visible ?
                this.renderNewConversationPanel() :
                this.renderStartNewConversation()}
        </div>;
    }

    protected renderNewConversationPanel(): JSX.Element {
        const { model } = this.props;
        return <div className='conversation-panel'>
            <div className='new-conversation-panel'>
                <ReviewCommentFormView context={model.newConversation} model={model} />
            </div>
        </div>;
    }

    protected renderStartNewConversation(): JSX.Element {
        const { model } = this.props;
        return <button className='start-new-conversation secondary theia-button'
            onClick={() => model.newConversation.form.open()}>Start a New Conversation</button>;
    }
}
export namespace GitHubEditorComment {
    export interface Props {
        model: GitHubEditorModel
    }
}
