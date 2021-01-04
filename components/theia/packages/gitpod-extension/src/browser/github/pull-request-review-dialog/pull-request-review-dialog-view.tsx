/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as React from "react";
import { GitHubModel, PullRequestReviewEvent, SubmitPullRequestReviewParams } from "../github-model";

export class PullRequestReviewDialogView extends React.Component<PullRequestReviewView.Props, SubmitPullRequestReviewParams> {

    constructor(props: PullRequestReviewView.Props) {
        super(props);
        this.state = {
            event: PullRequestReviewEvent.COMMENT,
            body: ''
        };
    }

    protected readonly updateBody = (e: React.ChangeEvent<HTMLTextAreaElement>) => this.setState({
        body: e.currentTarget.value
    }, this.props.validate);
    protected readonly updateEvent = (e: React.ChangeEvent<HTMLInputElement>) => this.setState({
        event: e.currentTarget.value as any
    }, this.props.validate);

    protected body: HTMLTextAreaElement | null;
    protected readonly setBody = (body: HTMLTextAreaElement | null) => this.body = body;

    componentDidMount(): void {
        if (this.body) {
            this.body.focus();
        }
    }

    render() {
        return <div>
            <textarea placeholder="Review summary"
                value={this.state.body}
                onChange={this.updateBody}
                ref={this.setBody} />
            <div>
                {this.createReviewEvent({
                    value: PullRequestReviewEvent.COMMENT,
                    label: "Comment",
                    description: "Submit general feedback without explicit approval."
                })}
                {this.createReviewEvent({
                    value: PullRequestReviewEvent.APPROVE,
                    label: "Approve",
                    description: "Submit feedback and approve merging these changes."
                })}
                {this.createReviewEvent({
                    value: PullRequestReviewEvent.REQUEST_CHANGES,
                    label: "Request changes",
                    description: "Submit feedback that must be addressed before merging."
                })}
            </div>
        </div>;
    }

    protected createReviewEvent({ value, label, description }: {
        value: PullRequestReviewEvent
        label: string
        description: string
    }): JSX.Element {
        return <div className="state-option">
            <label>
                <input className="radiobox" type="radio" name="pull-request-review-state" value={value}
                    checked={this.state.event === value}
                    onChange={this.updateEvent} />
                    <div>
                        <div className="label">{label}</div>
                        <div className="description">{description}</div>
                    </div>
            </label>
        </div>;
    }

}
export namespace PullRequestReviewView {
    export interface Props {
        model: GitHubModel
        validate: () => void
    }
}
