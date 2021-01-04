/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as React from 'react';
import { PullRequestReview } from '../github-model';
import { Timeago, ActorLink, ActorAvatarLink } from '../github-views';

export namespace PullRequestReviewView {
    export interface Props {
        review: PullRequestReview
    }
}
export class PullRequestReviewView extends React.Component<PullRequestReviewView.Props> {

    render(): JSX.Element {
        // TODO PR review comments
        const review = this.props.review;
        const time = review.submittedAt || review.createdAt;
        return <div className="timeline-item">
            <div className="info">
                <span className="icon-eye" />
                <ActorAvatarLink actor={review.author} size='small' />
                <span className="header">
                    <ActorLink actor={review.author} /> reviewed {Timeago({ time })}
                </span>
            </div>
            <div dangerouslySetInnerHTML={{ __html: review.bodyHTML }} />
        </div>;
    }

}
