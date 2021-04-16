/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as React from 'react';
import { QuickOpenService, DISABLED_CLASS } from '@theia/core/lib/browser';
import { Git } from '@theia/git/lib/common';
import { ActorAvatarLink } from '../github-views';
import { GitHubModel, PullRequest, PullRequestState, MergeableState } from '../github-model';
import { PullRequestReviewDialog } from '../pull-request-review-dialog';
import { PullRequestTimelineView } from './pull-request-timeline-view';
import { PullRequestBaseSelect } from './pull-request-base-select';
import { NewPullRequest } from './new-pull-request';
import { GitSyncView } from './git-sync-view';
import { RefreshView } from './refresh-view';

export class PullRequestView extends React.Component<PullRequestView.Props> {

    protected readonly showDiff = () => this.props.showDiff();
    protected readonly showConversations = () => this.props.showConversations();
    protected readonly openReviewDialog = async () => {
        const dialog = new PullRequestReviewDialog(this.props);
        await dialog.open();
    }
    protected readonly merge = () => this.props.merge();

    render(): JSX.Element {
        const pullRequest = this.props.gitHub.pullRequest;
        if (pullRequest) {
            return this.renderPullRequest(pullRequest);
        }
        return this.renderNewPullRequest();
    }

    protected renderPullRequest(pullRequest: PullRequest): JSX.Element {
        const { gitHub } = this.props;
        return <React.Fragment>
            <div className="pr-panel pr-header">
                <GitSyncView git={this.props.git} syncService={this.props.syncService} repositories={this.props.repositories} />
                <RefreshView gitHub={this.props.gitHub}>
                    {this.renderPullRequestState(pullRequest)}
                    <span className="pr-title header">
                        {pullRequest.title}
                    </span>
                    <span className="pr-link">
                        <a href={pullRequest.url} target="_blank">
                            <span className="icon-github-logo"></span> <span className="pr-number">#{pullRequest.number}</span>
                        </a>
                    </span>
                </RefreshView>
                <div className="pr-avatar-and-base-select">
                    <ActorAvatarLink actor={pullRequest.author} size='medium' />
                    <PullRequestBaseSelect
                        model={this.props.baseSelect}
                        quickOpenService={this.props.quickOpenService}
                        showDiff={this.showDiff}
                    />
                </div>
                {this.renderMergeState(pullRequest)}
                <div className="pr-conversations-and-review">
                    <div className="pr-conversations pr-base-action" onClick={this.showConversations}>
                        <span className="icon-comment-discussion" /> Conversations <span className="counter">{gitHub.conversationCount}</span>
                    </div>
                    <div className="pr-review-button">
                        <button onClick={this.openReviewDialog} className="theia-button">
                            Review Changes {!!gitHub.pendingPullRequestReview && <span className="counter">{gitHub.pendingComments.length}</span>}
                        </button>
                    </div>
                </div>
            </div>
            <PullRequestViewContent pullRequest={pullRequest} gitHub={gitHub} resolveScrollContainer={this.props.resolveScrollContainer} />
        </React.Fragment>;
    }
    protected renderPullRequestState(pullRequest: PullRequest) {
        if (pullRequest.state === PullRequestState.OPEN) {
            return <span className="pr-badge open"><span className="icon-git-pull-request" />Open</span>;
        }
        if (pullRequest.state === PullRequestState.MERGED) {
            return <span className="pr-badge merged"><span className="icon-git-merge" />Merged</span>;
        }
        return <span className="pr-badge closed"><span className="icon-git-pull-request" />Closed</span>;
    }
    protected renderMergeState({ viewerCanUpdate, mergeable, merged }: PullRequest) {
        if (!viewerCanUpdate || merged || mergeable === MergeableState.UNKNOWN) {
            return null;
        }
        if (mergeable === MergeableState.MERGEABLE) {
            return <div className="pr-merge">
                <span className="merge-status">
                    <span className="fa fa-lg fa-check merge-icon" />
                    This branch has no conflicts
                </span>
                <button onClick={this.merge} className="theia-button">Merge</button>
            </div>
        }
        return <div className="pr-merge">
            <span className="merge-status">
                <span className="fa fa-lg fa-exclamation-triangle merge-icon" />
                This branch has conflicts that must be resolved
            </span>
            <button className={DISABLED_CLASS + " theia-button"}>Merge</button>
        </div>
    }

    protected renderNewPullRequest(): JSX.Element {
        const { gitHub } = this.props;
        const { base, head, commonParentCommit } = gitHub;
        if (gitHub.hasChanges) {
            return <div className="pr-panel">
                <GitSyncView git={this.props.git} syncService={this.props.syncService} repositories={this.props.repositories} />
                <NewPullRequest
                    gitHub={gitHub}
                    showDiff={this.props.showDiff}
                    baseSelect={this.props.baseSelect}
                    quickOpenService={this.props.quickOpenService} />
            </div>;
        }
        if (base && head) {
            let message = <span><strong>{base.shortName}</strong> and <strong>{head.shortName}</strong> are identical.</span>;
            if (!commonParentCommit) {
                message = <span><strong>{base.shortName}</strong> and <strong>{head.shortName}</strong> are entirely different commit histories.</span>;
            }
            return <div className="pr-panel no-changes">
                <GitSyncView git={this.props.git} syncService={this.props.syncService} repositories={this.props.repositories} />
                <RefreshView gitHub={this.props.gitHub}>
                    <PullRequestBaseSelect model={this.props.baseSelect} quickOpenService={this.props.quickOpenService} showDiff={this.props.showDiff} />
                </RefreshView>
                <h3>There are no changes.</h3>
                <p>{message}</p>
            </div>;
        }

        return <div className="pr-panel">
            <GitSyncView git={this.props.git} syncService={this.props.syncService} repositories={this.props.repositories} />
        </div>;
    }

}
export namespace PullRequestView {
    export interface Props extends GitSyncView.Props {
        git: Git
        gitHub: GitHubModel
        quickOpenService: QuickOpenService
        baseSelect: PullRequestBaseSelect.Model
        showDiff: () => Promise<void>
        showConversations: () => Promise<void>
        merge: () => Promise<void>
        resolveScrollContainer: (el: HTMLElement) => void
    }
}

export namespace PullRequestViewContent {
    export interface Props {
        pullRequest: PullRequest
        gitHub: GitHubModel
        resolveScrollContainer: (el: HTMLElement) => void
    }
}

export class PullRequestViewContent extends React.Component<PullRequestViewContent.Props> {
    protected container?: HTMLElement;

    render() {
        const { pullRequest, gitHub } = this.props;
        return <div className="pr-panel pr-content" ref={ref => this.container = ref || undefined}>
            {
                pullRequest.bodyHTML && pullRequest.bodyHTML !== "" ?
                    <div className="pr-body" dangerouslySetInnerHTML={{ __html: pullRequest.bodyHTML }} /> :
                    ""
            }
            <PullRequestTimelineView model={gitHub} />
        </div>;
    }

    componentDidMount() {
        if (this.container) {
            this.props.resolveScrollContainer(this.container);
        }
    }
}
