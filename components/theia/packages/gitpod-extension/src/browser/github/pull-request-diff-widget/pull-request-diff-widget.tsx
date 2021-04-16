/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as React from "react";
import { injectable, inject, postConstruct } from "inversify";
import { Disposable, DisposableCollection } from "@theia/core";
import { Git } from "@theia/git/lib/common";
import { GitDiffWidget } from "@theia/git/lib/browser/diff/git-diff-widget";
import { GitHubFrontendContribution } from "../github-frontend-contribution";
import { GitHubModel } from "../github-model";
import { GitHosterModel } from "../../githoster/model/githoster-model";
import { github } from "../github-decorators";

@injectable()
export class PullRequestDiffWidget extends GitDiffWidget {

    @inject(GitHosterModel) @github
    protected readonly gitHubModel: GitHubModel;

    @inject(GitHubFrontendContribution)
    protected readonly gitHub: GitHubFrontendContribution;

    @postConstruct()
    protected init() {
        super.init();
        this.onRender.push(Disposable.create(() => setTimeout(() => this.trySelectFirst(), 200)));
    }

    protected readonly toDisposeOnContent = new DisposableCollection();
    setContent(options: Git.Options.Diff): Promise<void> {
        this.toDisposeOnContent.dispose();
        this.toDispose.push(this.toDisposeOnContent);
        if (GitHubModel.DiffOptions.is(options)) {
            this.toDisposeOnContent.push(this.gitHubModel.onDidChange(() => this.refreshContent()));
        }
        return super.setContent(options);
    }

    protected async refreshContent(): Promise<void> {
        const options = await this.gitHubModel.getDiffOptions();
        return this.setContent(options);
    }

    protected renderDiffListHeader(): React.ReactNode {
        const options = this.options;
        if (!(GitHubModel.DiffOptions.is(options))) {
            return super.renderDiffListHeader();
        }
        return this.doRenderDiffListHeader(
            <React.Fragment key='difflist-header-pr-title'>{this.renderPRTitle(options)}</React.Fragment>,
            <React.Fragment key='difflist-header-open-pr'>{this.renderOpenPullRequest(options)}</React.Fragment>,
            <React.Fragment key='difflist-header-toolbar'>{this.renderToolbar()}</React.Fragment>
        );
    }

    protected renderPRTitle(options: GitHubModel.DiffOptions): React.ReactNode {
        if (options.pullRequest && options.pullRequest.author) {
            return <div className="pr-avatar-and-title">
                <a className="github-author-avatar-link" target="_blank" href={options.pullRequest.author.url}>
                    <img className="github-author-avatar medium" src={options.pullRequest.author.avatarUrl} title={options.pullRequest.author.login} />
                </a>
                <span className="pr-title">{options.pullRequest.title}</span>
            </div>;
        }
        return "There is no pull request.";
    }

    protected renderOpenPullRequest(options: GitHubModel.DiffOptions): React.ReactNode {
        return <div className='pr-details'>
            <a className='detail-link' onClick={this.openPullRequest}>details</a>
        </div>
    }
    protected readonly openPullRequest = () => this.gitHub.openView({ toggle: false, reveal: true });

    protected trySelectFirst(): void {
        const options = this.options;
        if (PullRequestDiffWidget.WidgetOptions.is(options)) {
            if (options.trySelectFirst) {
                if (this.indexOfSelected === -1) {
                    this.navigateRight();
                }
            }
        }
    }

}

export namespace PullRequestDiffWidget {

    export interface WidgetOptions {
        readonly trySelectFirst: boolean;
    }

    export namespace WidgetOptions {
        export function is(options: any): options is WidgetOptions {
            return options && 'trySelectFirst' in options;
        }
    }

    export interface DiffOptions extends GitHubModel.DiffOptions, WidgetOptions { }

}