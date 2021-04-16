/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as React from 'react';
import * as fuzzy from 'fuzzy';
import { Emitter, Event, DisposableCollection, Disposable, CancellationTokenSource } from '@theia/core';
import { GitHubModel, PullRequest } from '../github-model';
import { Repository } from "../../githoster/model/types"
import { QuickOpenService, QuickOpenItem, QuickOpenMode } from '@theia/core/lib/browser';
import { throttle } from 'lodash';

export class PullRequestBaseSelect extends React.Component<PullRequestBaseSelect.Props> {

    render(): JSX.Element | null {
        const { head, fork, branch } = this.props.model;
        if (head && fork && branch) {
            return <div className='pr-base'>
                {this.renderFrom()}
                {this.renderInto()}
            </div >;
        }
        return null;
    }

    protected renderFrom(): JSX.Element {
        const { pullRequest } = this.props.model.gitHub;
        return pullRequest ?
            <div>wants to merge {this.renderCommits()}</div> :
            <div>merge {this.renderCommits()}</div>
    }
    protected renderCommits(): JSX.Element {
        const { commitCount } = this.props.model.gitHub;
        return <span className="pr-base-action"
            onClick={this.props.showDiff}
            title="Show changed files"
        >{commitCount} commit{commitCount === 1 ? '' : 's'}</span>
    }

    protected renderInto(): JSX.Element {
        return <div>into {this.renderFork()} {this.renderBranch()}</div>;
    }
    protected renderFork(): JSX.Element | false {
        const { fork } = this.props.model;
        return <span className="pr-base-action"
            onClick={this.openFork}
            title="Choose a base repository"
        >{fork!.fullName} <span className="fa fa-caret-down" /></span>;
    }
    protected renderBranch(): JSX.Element {
        const { branch } = this.props.model;
        return <span className="pr-base-action"
            onClick={this.openBranch}
            title="Choose a base branch"
        >{branch} <span className="fa fa-caret-down" /></span>;
    }

    protected readonly toDispose = new DisposableCollection();
    componentDidMount(): void {
        this.toDispose.push(this.props.model.onChanged(() => this.forceUpdate()));
    }
    componentWillUnmount(): void {
        this.toDispose.dispose();
    }

    protected readonly openFork = async () => {
        const { model, quickOpenService } = this.props;
        let prefix = '';
        let selectedIndex = 0;
        let selectIndex = 0;
        let loading = true;
        const tokenSource = new CancellationTokenSource();
        const items: QuickOpenItem[] = [new QuickOpenItem({ label: 'Loading...' })];
        quickOpenService.open({
            onType: async (lookFor, acceptor) => {
                prefix = lookFor;
                const selectedItemIndex = loading ? selectedIndex : selectedIndex - 1;
                if (lookFor) {
                    selectIndex = 0;
                    const result = [];
                    for (const [index, item] of items.entries()) {
                        if (loading && index === 0) {
                            result.push(item);
                        } else if (fuzzy.match(lookFor, item.getLabel()!)) {
                            if (index === selectedItemIndex) {
                                selectIndex = result.length;
                            }
                            result.push(item);
                        }
                    }
                    acceptor(result);
                } else {
                    selectIndex = selectedItemIndex;
                    acceptor(items);
                }
            }
        }, {
                prefix,
                fuzzyMatchLabel: true,
                showItemsWithoutHighlight: true,
                placeholder: 'Choose a base repository',
                onClose: () => tokenSource.cancel(),
                selectIndex: () => selectIndex
            });
        const { token } = tokenSource;

        const refresh = throttle(() => {
            if (!token.isCancellationRequested) {
                quickOpenService.refresh();
            }
        }, 500, { leading: true});

        token.onCancellationRequested(() => refresh.cancel());

        await model.gitHub.getForks(fork => {
            if (token.isCancellationRequested) {
                return;
            }
            const index = items.length;
            items.push(new QuickOpenItem({
                label: fork.fullName,
                run: mode => {
                    selectedIndex = index;
                    if (mode !== QuickOpenMode.OPEN) {
                        return false;
                    }
                    this.props.model.updateFork(fork);
                    return true;
                }
            }));
            refresh();
        }, token);
        if (token.isCancellationRequested) {
            return;
        }
        loading = false;
        items.shift();
        refresh();
    };

    protected readonly openBranch = () => {
        const { model, quickOpenService } = this.props;
        const items = model.branches.map(branch => new QuickOpenItem({
            label: branch,
            run: mode => {
                if (mode !== QuickOpenMode.OPEN) {
                    return false;
                }
                model.updateBranch(branch);
                return true;
            }
        }));
        quickOpenService.open({
            onType: (_, acceptor) => acceptor(items)
        }, {
                fuzzyMatchLabel: true,
                placeholder: "Choose a base branch"
            });
    };


}
export namespace PullRequestBaseSelect {
    export class Model implements Disposable {
        head?: GitHubModel.Ref
        pullRequest?: PullRequest
        fork?: Repository
        branch?: string
        branches: string[] = []

        protected readonly onChangedEmitter = new Emitter<void>();
        readonly onChanged: Event<void> = this.onChangedEmitter.event;

        protected readonly toDispose = new DisposableCollection();

        constructor(
            readonly gitHub: GitHubModel
        ) {
            this.update();
            this.toDispose.push(gitHub.onDidChange(() => this.update()));
            this.toDispose.push(this.onChangedEmitter);
        }

        dispose(): void {
            this.toDispose.dispose();
        }

        protected async update(): Promise<void> {
            const { base, head, pullRequest } = this.gitHub;
            if (base) {
                this.head = head;
                this.pullRequest = pullRequest;
                this.fork = base.repository;
                this.branches = await this.gitHub.getBranches(base.repository) || [];
                this.branch = base.name;
            } else {
                this.head = undefined;
                this.pullRequest = undefined;
                this.fork = undefined;
                this.branch = undefined;
            }
            this.fireChanged();
        }

        protected fireChanged(): void {
            this.onChangedEmitter.fire(undefined);
        }

        async updateFork(fork: Repository): Promise<void> {
            const branches = await this.gitHub.getBranches(fork);
            const branch = branches && (this.branch && branches.indexOf(this.branch) !== -1 ? this.branch : branches[0]);
            this.fork = fork;
            this.branches = branches;
            this.branch = branch;
            this.fireChanged();
            this.refresh();
        }

        async updateBranch(value: string): Promise<void> {
            this.branch = value;
            this.fireChanged();
            this.refresh();
        }

        async refresh(): Promise<void> {
            const { fork, branch } = this;
            const { head } = this.gitHub;
            if (fork && branch && head) {
                await this.gitHub.refresh({
                    kind: 'compare',
                    head: head.raw,
                    base: {
                        repository: fork.name,
                        owner: fork.owner,
                        refName: branch
                    }
                });
            }
        }
    }
    export interface Props {
        model: Model,
        showDiff: () => Promise<void>
        quickOpenService: QuickOpenService
    }
}