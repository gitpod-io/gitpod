/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as React from 'react';
import { CommentFormView, CommentForm } from '../comment-form';
import { GitHubModel } from '../github-model';
import { PullRequestBaseSelect } from './pull-request-base-select';
import { QuickOpenService } from '@theia/core/lib/browser';
import { NewPullRequestContent } from './new-pull-request-content';
import { RefreshView } from './refresh-view';

export class NewPullRequest extends React.Component<NewPullRequest.Props, NewPullRequest.State> {

    protected readonly form: CommentForm;
    constructor(props: NewPullRequest.Props) {
        super(props);
        const commit = props.gitHub.lastCommit;
        let { title, body } = NewPullRequestContent.parse(commit && commit.message || '');
        this.state = { title };
        this.form = new CommentForm({
            defaultBody: body,
            isValid: () => this.state.title.trim().length !== 0
        });
        this.openForm();
    }

    protected async openForm(): Promise<void> {
        let body = this.form.body;
        const template = await this.props.gitHub.resolvePullRequestTemplate();
        this.form.open();
        if (template) {
            if (body) {
                body += '\n\n\n';
            }
            body += template;
            this.form.body = body;
        }
    }

    protected readonly setTitle = (e: React.ChangeEvent<HTMLInputElement>) => this.setState({ title: e.currentTarget.value });

    render(): JSX.Element {
        const { form } = this;
        const { gitHub } = this.props;
        return <React.Fragment>
            <RefreshView gitHub={this.props.gitHub}>
                <span className="pr-badge open"><span className="icon-git-pull-request" />New</span>
                <input className='theia-input pr-title-input' placeholder='Title' value={this.state.title} onChange={this.setTitle} />
            </RefreshView>
            <PullRequestBaseSelect model={this.props.baseSelect} quickOpenService={this.props.quickOpenService} showDiff={this.props.showDiff} />
            <CommentFormView gitHub={gitHub} form={form} renderActions={this.renderActions} />
        </React.Fragment>
    }

    protected readonly createPullRequest = () => this.form.submit(body => this.props.gitHub.createPullRequest({
        title: this.state.title,
        body
    }));
    protected readonly renderActions = ({ Actions, Submit }: CommentFormView.RenderActionsProps) => <Actions>
        <Submit onClick={this.createPullRequest}>Create pull request</Submit>
    </Actions>;

}
export namespace NewPullRequest {
    export interface Props {
        gitHub: GitHubModel;
        showDiff: () => Promise<void>
        quickOpenService: QuickOpenService;
        baseSelect: PullRequestBaseSelect.Model;
    }
    export interface State {
        title: string
    }
}
