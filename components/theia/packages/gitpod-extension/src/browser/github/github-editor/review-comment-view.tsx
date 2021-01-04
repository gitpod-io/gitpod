/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { DisposableCollection } from '@theia/core';
import { ActorLink, ActorAvatarLink, Timeago } from '../github-views';
import { GitHubEditorModel } from "./github-editor-model";
import { ReviewCommentFormView } from './review-comment-form-view';
import { ReviewComment } from '../review-conversation';

export class ReviewCommentView extends React.Component<ReviewCommentView.Props> {

    protected readonly toDispose = new DisposableCollection();
    componentDidMount(): void {
        const { comment } = this.props;
        this.toDispose.push(comment.onReveal(() => this.reveal()));
        this.toDispose.push(comment.form.onDidChange(() => this.forceUpdate()));
    }
    componentWillUnmount(): void {
        this.toDispose.dispose();
    }

    reveal(): void {
        const { model, editor } = this.props;
        const node = ReactDOM.findDOMNode(this);
        if (node instanceof HTMLElement) {
            const lineNumberTop = editor.getTopForLineNumber(model.lineNumber);
            const scrollTop = lineNumberTop + node.offsetTop;
            editor.setScrollTop(scrollTop);
        }
    }

    render(): JSX.Element {
        const { comment, model } = this.props;
        if (comment.form.visible) {
            return <div className='comment-form'>
                <ReviewCommentFormView model={model} context={comment} />
            </div>;
        }
        const time = comment.raw.createdAt;
        return <div className='comment'>
            <ActorAvatarLink actor={comment.raw.author} size='medium' />
            <div className='content'>
                <div className='info'>
                    <span className='header'>
                        <ActorLink actor={comment.raw.author} /> commented {Timeago({ time })}
                        {!comment.raw.publishedAt && <span className='pending-badge'>Pending</span>}
                    </span>
                    <span className='actions'>
                        <span className="icon-pencil action" onClick={() => comment.form.open()} title="Edit comment" />
                        <span className="icon-trashcan action" onClick={() => comment.delete()} title="Delete comment" />
                    </span>
                </div>
                <div dangerouslySetInnerHTML={{ __html: comment.raw.bodyHTML }} />
            </div>
        </div>;
    }
}
export namespace ReviewCommentView {
    export interface Props {
        model: GitHubEditorModel
        comment: ReviewComment
        editor: monaco.editor.ICodeEditor
    }
}