/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as React from 'react';
import { GitHubModel, Commit, PullRequestReview, IssueComment } from '../github-model';
import { CommitsView } from './commits-view';
import { PullRequestReviewView } from './pull-request-review-view';
import { IssueCommentView } from './issue-comment-view';

export namespace PullRequestTimelineView {
    export interface Props {
        model: GitHubModel
    }
}
export class PullRequestTimelineView extends React.Component<PullRequestTimelineView.Props> {

    render(): JSX.Element {
        const timeline = [];
        let commits = [];
        for (const item of this.props.model.timeline) {
            if (Commit.is(item)) {
                commits.push(item);
            } else if (commits.length !== 0) {
                timeline.push(<CommitsView key={commits[0].id} commits={commits} />);
                commits = [];
            }
            if (PullRequestReview.is(item)) {
                timeline.push(<PullRequestReviewView key={item.id} review={item} />);
            } else if (IssueComment.is(item)) {
                timeline.push(<IssueCommentView key={item.id} comment={item} />);
            }
            // TODO merged events
            // TODO head ref forced pushed event
            // TODO commit comment thread
            // TODO cross referenced events
            // TODO what else? https://developer.github.com/v4/union/pullrequesttimelineitem/
        }
        if (commits.length !== 0) {
            timeline.push(<CommitsView key={commits[0].id} commits={commits} />);
            commits = [];
        }
        return <div className="pr-timeline">{timeline}</div>;
    }

}
