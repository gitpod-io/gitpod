/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import React = require("react");
import { GitSyncService } from "@theia/git/lib/browser/git-sync-service";
import { GitRepositoryTracker } from "@theia/git/lib/browser/git-repository-tracker";
import { DisposableCollection } from "@theia/core";
import { DISABLED_CLASS } from "@theia/core/lib/browser";
import { Git } from "@theia/git/lib/common";

export class GitSyncView extends React.Component<GitSyncView.Props> {

    protected readonly toDispose = new DisposableCollection();
    componentWillMount(): void {
        const { syncService, repositories } = this.props;
        this.toDispose.push(syncService.onDidChange(() => this.forceUpdate()));
        this.toDispose.push(repositories.onGitEvent(() => this.forceUpdate()));
    }
    componentWillUnmount(): void {
        this.toDispose.dispose();
    }

    render(): JSX.Element | null {
        const { repositories } = this.props;
        const status = repositories.selectedRepositoryStatus;
        if (!status || !status.branch) {
            return null;
        }
        const { upstreamBranch, aheadBehind } = status;
        if (!upstreamBranch) {
            return <div className="sync-view">
                {this.renderMessage(`The current branch ${status.branch} has no upstream branch.`)}
                {this.renderPublish()}
            </div>
        }
        if (aheadBehind) {
            const { ahead, behind } = aheadBehind;
            if (ahead === 0 && behind === 0) {
                return null;
            }
            if (behind === 0) {
                return <div className="sync-view">
                    {this.renderMessage(`Your branch is ahead of ${upstreamBranch} by ${this.renderCommits(ahead)} commit.`)}
                    {this.renderPush()}
                </div>
            }
            if (aheadBehind.ahead === 0) {
                return <div className="sync-view">
                    {this.renderMessage(`Your branch is behind ${upstreamBranch} by ${this.renderCommits(behind)}.`)}
                    {this.renderSynchronize()}
                </div>
            }
            return <div className="sync-view">
                {this.renderMessage(`Your branch and ${upstreamBranch} have diverged, and have ${ahead} and ${behind} different commits each, respectively.`)}
                {this.renderSynchronize()}
            </div>
        }
        return null;
    }

    protected renderCommits(commits: number): string {
        return `${commits} commit${commits === 1 ? '' : 's'}`;
    }
    protected renderMessage(message: string): JSX.Element {
        return <div className="sync-warn">
            <i className="fa fa-lg fa-exclamation-triangle sync-icon" />
            <span>{message}</span>
        </div>
    }

    protected renderPush(): JSX.Element {
        const { syncService } = this.props;
        if (syncService.canSync()) {
            return <button className="sync-action theia-button" onClick={this.push}>Push</button>;
        }
        return <button className={"sync-action theia-button " + DISABLED_CLASS}>Push</button>;
    }
    protected readonly push = async () => {
        const { git, syncService, repositories } = this.props;
        const repository = repositories.selectedRepository;
        if (repository) {
            syncService.setSyncing(true);
            try {
                await git.push(repository);
            } finally {
                syncService.setSyncing(false);
            }
        }
    }

    protected renderSynchronize(): JSX.Element {
        const { syncService } = this.props;
        if (syncService.canSync()) {
            return <button className="sync-action theia-button" onClick={this.sync}>Synchronize Changes...</button>;
        }
        return <button className={"sync-action theia-button " + DISABLED_CLASS}>Synchronize Changes...</button>;
    }
    protected readonly sync = () => this.props.syncService.sync();

    protected renderPublish(): JSX.Element {
        const { syncService } = this.props;
        if (syncService.canPublish()) {
            return <button className="sync-action theia-button" onClick={this.publish}>Publish Changes</button>;
        }
        return <button className={"sync-action theia-button " + DISABLED_CLASS}>Publish Changes</button>;
    }
    protected readonly publish = () => this.props.syncService.publish();

}
export namespace GitSyncView {
    export interface Props {
        git: Git
        syncService: GitSyncService
        repositories: GitRepositoryTracker
    }
}