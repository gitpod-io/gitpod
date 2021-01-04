/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as React from 'react';
import { IssueComment } from '../github-model';
import { ActorLink, ActorAvatarLink, Timeago } from '../github-views';

export namespace IssueCommentView {
    export interface Props {
        comment: IssueComment
    }
}
export class IssueCommentView extends React.Component<IssueCommentView.Props> {

    render(): JSX.Element {
        const comment = this.props.comment;
        const time = comment.createdAt;
        return <div className="timeline-item">
            <div className="info">
                <span className="icon-comment" />
                <ActorAvatarLink actor={comment.author} size='small' />
                <span className="header">
                    <ActorLink actor={comment.author} /> commented {Timeago({ time })}
                </span>
            </div>
            <div dangerouslySetInnerHTML={{ __html: comment.bodyHTML }} />
        </div>
    }

}
