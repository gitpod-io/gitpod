/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as React from "react";
import * as ReactDOM from "react-dom";
import { injectable, inject } from "inversify";
import { Message } from "@phosphor/messaging";
import { Disposable, MessageService, MaybePromise } from "@theia/core";
import { BaseWidget, QuickOpenService, QuickOpenItem, QuickOpenMode } from "@theia/core/lib/browser";
import { GitDiffContribution } from "@theia/git/lib/browser/diff/git-diff-contribution";
import { GitHubModel, MergeableState, PullRequest } from "../github-model";
import { PullRequestView } from "./pull-request-view";
import { ReviewConversationContribution } from "../review-conversation-view";
import { PullRequestBaseSelect } from "./pull-request-base-select";
import { PullRequestDiffWidget } from "../pull-request-diff-widget";
import { GitRepositoryTracker } from "@theia/git/lib/browser/git-repository-tracker";
import { GitSyncService } from "@theia/git/lib/browser/git-sync-service";
import { Git } from "@theia/git/lib/common";
import { Deferred } from "@theia/core/lib/common/promise-util";
import { GitHosterModel } from "../../githoster/model/githoster-model";
import { github } from "../github-decorators";

@injectable()
export class PullRequestWidget extends BaseWidget {

    static ID = 'pull-request-view';
    static LABEL = 'Pull Request';

    protected readonly baseSelect: PullRequestBaseSelect.Model;

    protected readonly deferredScrollContainer = new Deferred<HTMLElement>();

    constructor(
        @inject(Git) protected readonly git: Git,
        @inject(GitHosterModel) @github protected readonly gitHub: GitHubModel,
        @inject(QuickOpenService) protected readonly quickOpenService: QuickOpenService,
        @inject(GitDiffContribution) protected readonly gitDiff: GitDiffContribution,
        @inject(ReviewConversationContribution) protected readonly conversations: ReviewConversationContribution,
        @inject(GitRepositoryTracker) protected readonly repositories: GitRepositoryTracker,
        @inject(GitSyncService) protected readonly syncService: GitSyncService,
        @inject(MessageService) protected readonly messageService: MessageService
    ) {
        super();
        this.node.tabIndex = 0;
        this.node.classList.add('github-view');
        this.node.classList.add(PullRequestWidget.ID);
        this.id = PullRequestWidget.ID;
        this.title.label = PullRequestWidget.LABEL;
        this.title.caption = PullRequestWidget.LABEL;
        this.title.iconClass = 'github-view-icon';
        this.scrollOptions = {
            suppressScrollX: true
        }
        // TODO this.title.iconClass = 'fa fa-github'; // uncomment then icons in side bars are supported
        this.title.closable = true;
        this.toDispose.push(this.baseSelect = new PullRequestBaseSelect.Model(this.gitHub));
        this.toDispose.push(this.gitHub.onDidChange(() => this.update()));
        this.toDispose.push(Disposable.create(() => ReactDOM.unmountComponentAtNode(this.node)));
        this.update();
    }

    protected onActivateRequest(msg: Message): void {
        super.onActivateRequest(msg);
        this.node.focus();
    }

    protected onUpdateRequest(msg: Message): void {
        super.onUpdateRequest(msg);
        ReactDOM.render(<PullRequestView
            git={this.git}
            gitHub={this.gitHub}
            baseSelect={this.baseSelect}
            showDiff={this.internalShowDiff}
            showConversations={this.showConversations}
            quickOpenService={this.quickOpenService}
            repositories={this.repositories}
            syncService={this.syncService}
            merge={this.doMerge}
            resolveScrollContainer={this.deferredScrollContainer.resolve}
        />, this.node);
    }

    protected getScrollContainer(): MaybePromise<HTMLElement> {
        return this.deferredScrollContainer.promise;
    }

    protected readonly internalShowDiff = () => this.showDiff();
    async showDiff(widgetOptions: PullRequestDiffWidget.WidgetOptions = { trySelectFirst: false }): Promise<void> {
        const diffOptions = await this.gitHub.getDiffOptions();
        const options: PullRequestDiffWidget.DiffOptions = { ...widgetOptions, ...diffOptions };
        await this.gitDiff.showWidget(options);
    }

    readonly showConversations = async () => {
        await this.conversations.openView({
            activate: true
        });
    }

    canMerge(): boolean {
        return this.doCanMerge(this.gitHub.pullRequest);
    }
    merge(): Promise<void> {
        return this.doMerge();
    }
    protected doCanMerge(pullRequest: PullRequest | undefined): pullRequest is PullRequest {
        return !!pullRequest && !pullRequest.merged && pullRequest.viewerCanUpdate && pullRequest.mergeable !== MergeableState.UNKNOWN;
    }
    protected readonly doMerge = async () => {
        const pullRequest = this.gitHub.pullRequest;
        if (!this.doCanMerge(pullRequest)) {
            return;
        }
        if (pullRequest.mergeable === MergeableState.CONFLICTING) {
            this.messageService.warn('This branch has conflicts that must be resolved. Review and try the merge again.');
            return;
        }
        const items: {
            label: string,
            description: string,
            value: "merge" | "squash" | "rebase"
        }[] = [];
        if (pullRequest.repository.mergeCommitAllowed) {
            items.push({
                label: 'Create a merge commit',
                description: 'All commits from this branch will be added to the base branch via a merge commit.',
                value: 'merge'
            });
        }
        if (pullRequest.repository.squashMergeAllowed) {
            items.push({
                label: 'Squash and merge',
                description: 'The 1 commit from this branch will be added to the base branch.',
                value: 'squash'
            });
        }
        if (pullRequest.repository.rebaseMergeAllowed) {
            items.push({
                label: 'Rebase and merge',
                description: 'The 1 commit from this branch will be rebased and added to the base branch.',
                value: 'rebase'
            });
        }
        const mergeMethod = await this.pick(`Pick how changes should be merged:`, items);
        if (mergeMethod) {
            await this.gitHub.merge({ mergeMethod });
        }
    }

    // FIXME get rid of it after https://github.com/theia-ide/theia/issues/2197
    protected async pick<T>(placeholder: string, elements: { label: string, description: string, value: T }[]): Promise<T | undefined> {
        if (elements.length === 0) {
            return undefined;
        }
        if (elements.length === 1) {
            return elements[0].value;
        }
        return new Promise<T | undefined>(resolve => {
            const items = elements.map(element => {
                return new QuickOpenItem({
                    label: element.label,
                    description: element.description,
                    run: mode => {
                        if (mode !== QuickOpenMode.OPEN) {
                            return false;
                        }
                        resolve(element.value);
                        return true;
                    }
                });
            });
            this.quickOpenService.open({
                onType: (_, acceptor) => acceptor(items)
            }, { placeholder, onClose: () => resolve(undefined) });
        });
    }

}
