/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as React from "react";
import * as ReactDOM from "react-dom";
import { Message } from "@phosphor/messaging";
import { Disposable, MaybePromise } from "@theia/core";
import { Key, AbstractDialog, DialogMode, DialogError } from "@theia/core/lib/browser";
import { GitHubModel, SubmitPullRequestReviewParams } from "../github-model";
import { PullRequestReviewDialogView } from "./pull-request-review-dialog-view";
import { GitHubError } from "../github-model/github";

export class PullRequestReviewDialog extends AbstractDialog<SubmitPullRequestReviewParams | undefined> {

    protected readonly gitHub: GitHubModel;

    protected readonly cancelReview: HTMLButtonElement;

    constructor(props: PullRequestViewReviewDialog.Props) {
        super({ title: '' });
        this.node.classList.add("github-view");
        this.node.classList.add("pull-request-review-dialog");

        this.controlPanel.appendChild(this.cancelReview = this.createButton('Cancel review'));
        this.appendAcceptButton('Submit review');

        this.gitHub = props.gitHub;
        this.update();
        this.toDispose.push(this.gitHub.onDidChange(() => this.update()));
        this.toDispose.push(Disposable.create(() => ReactDOM.unmountComponentAtNode(this.contentNode)));
    }

    protected view: PullRequestReviewDialogView | null = null;
    get value(): SubmitPullRequestReviewParams | undefined {
        return this.view ? this.view.state : undefined;
    }

    protected error: Error | undefined;
    protected async accept(): Promise<void> {
        if (!this.resolve) {
            return;
        }
        this.error = undefined;
        try {
            const { value } = this;
            if (value) {
                await this.gitHub.submitPullRequestReview(value);
            } else {
                await this.gitHub.deletePendingPullRequestReview();
            }
        } catch (e) {
            if (GitHubError.is(e)) {
                this.error = e;
            } else {
                throw e;
            }
        }
        super.accept();
    }

    protected isValid(value: SubmitPullRequestReviewParams | undefined, mode: DialogMode): MaybePromise<DialogError> {
        if (mode === 'open') {
            const errors = GitHubError.getErrors(this.error);
            if (errors) {
                return errors.map(e => e.message).join('\n');
            }
        }
        return super.isValid(value, mode);
    }

    protected onActivateRequest(msg: Message): void {
        // no-op
    }

    protected onAfterAttach(msg: Message): void {
        super.onAfterAttach(msg);
        this.addKeyListener(this.cancelReview, Key.ENTER, () => {
            this.view = null;
            this.accept();
        }, 'click');
    }

    protected onUpdateRequest(msg: Message): void {
        super.onUpdateRequest(msg);
        this.titleNode.textContent = this.renderTitle();
        this.cancelReview.style.display = !this.gitHub.pendingPullRequestReview ? 'none' : 'block';
        ReactDOM.render(
            <PullRequestReviewDialogView model={this.gitHub} ref={view => this.view = view} validate={this.doValidate} />,
            this.contentNode
        );
    }

    protected readonly doValidate = () => this.validate()

    protected renderTitle(): string {
        if (!this.gitHub.pendingPullRequestReview) {
            return 'Submit your review';
        }
        const pendingCommentCount = this.gitHub.pendingComments.length;
        return `Submit your ${pendingCommentCount} pending comment${pendingCommentCount === 1 ? '' : 's'}`;
    }

}
export namespace PullRequestViewReviewDialog {
    export interface Props {
        gitHub: GitHubModel
    }
}
