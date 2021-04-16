/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as React from 'react';
import { DisposableCollection } from '@theia/core';
import { GitHubModel } from '../github-model';
import { CommentForm } from './comment-form';

export class CommentFormView extends React.Component<CommentFormView.Props, CommentFormView.State> {

    constructor(props: CommentFormView.Props) {
        super(props);
        this.state = {
            focus: true,
            preview: false,
            markdown: undefined
        };
    }

    protected readonly toDispose = new DisposableCollection();
    componentDidMount(): void {
        const form = this.props.form;
        this.toDispose.push(form.onDidChange(() =>
            this.setState({ markdown: undefined })
        ));
    }

    componentWillUnmount(): void {
        this.toDispose.dispose();
    }

    protected readonly loadPreview = async () => {
        if (this.state.markdown) {
            return;
        }
        const { form, gitHub } = this.props;
        const markdown = await gitHub.renderMarkdown(form.body);
        if (this.toDispose.disposed) {
            return;
        }
        this.setState({ markdown });
    }
    protected readonly revealPreview = () => {
        this.setState({ preview: true });
        this.loadPreview();
    }
    protected readonly revealBody = () => this.setState({ preview: false, focus: true });

    protected readonly cancel = () => this.props.form.close();
    protected readonly updateBody = (e: React.ChangeEvent<HTMLTextAreaElement>) => this.props.form.body = e.currentTarget.value;
    protected readonly setBody = (body: HTMLTextAreaElement | null) => {
        if (body) {
            const wheelListener = (e: Event) => e.stopImmediatePropagation();
            body.addEventListener('mousewheel', wheelListener);
            body.addEventListener('DOMMouseScroll', wheelListener);
        }
        if (body && this.state.focus) {
            body.focus();
            this.setState({ focus: false });
        }
    }

    protected readonly renderActionsProps: CommentFormView.RenderActionsProps = {
        Actions: ({ children }) => <div className='actions'>{children}</div>,
        Action: ({ secondary, enabled, onClick, children }) => {
            if (enabled === undefined || enabled) {
                return <button onClick={onClick} className={secondary ? "secondary theia-button" : "theia-button"}>{children}</button>;
            }
            return <button disabled className="theia-button">{children}</button>
        },
        Submit: props => this.renderActionsProps.Action({ ...props, enabled: this.props.form.valid }),
        Cancel: () => this.renderActionsProps.Action({ secondary: true, onClick: this.cancel, children: 'Cancel' })
    }

    render(): JSX.Element | null {
        const { form, renderActions } = this.props;
        if (!form.visible) {
            return null;
        }
        const markdown = this.props.form.body ? this.state.markdown || '<p>Loading preview...</p>' : '<p>Nothing to preview</p>';
        return <div className='github-comment-form'>
            <div className='p-TabBar theia-app-centers' data-orientation='horizontal'>
                <ul className='p-TabBar-content'>
                    <li className={'p-TabBar-tab' + (!this.state.preview ? ' p-mod-current' : '')} onClick={this.revealBody}>
                        <div>Write</div>
                    </li>
                    <li className={'p-TabBar-tab' + (this.state.preview ? ' p-mod-current' : '')} onClick={this.revealPreview} onMouseOver={this.loadPreview}>
                        <div>Preview</div>
                    </li>
                </ul>
            </div>
            {this.state.preview ?
                <div className='preview-box' dangerouslySetInnerHTML={{ __html: markdown }} /> :
                <textarea placeholder='Leave a comment'
                    value={form.body}
                    onChange={this.updateBody}
                    ref={this.setBody}
                />
            }
            {form.errors.length !== 0 && <div>
                {form.errors.map((message, index) => <div key={index}>{message}</div>)}
            </div>}
            {renderActions && renderActions(this.renderActionsProps)}
        </div>
    }

}
export namespace CommentFormView {
    export interface Props {
        gitHub: GitHubModel
        form: CommentForm
        renderActions?: (props: RenderActionsProps) => any
    }
    export interface RenderActionsProps {
        Actions: Actions
        Action: Action
        Submit: Submit
        Cancel: Cancel
    }
    export type Actions = (props: { children?: any }) => JSX.Element;
    export type Action = (props: { secondary?: boolean, enabled?: boolean, onClick: () => any, children?: any }) => JSX.Element;
    export type Cancel = () => JSX.Element;
    export type Submit = (props: { onClick: () => any, children?: any }) => JSX.Element;
    export interface State {
        focus: boolean,
        preview: boolean,
        markdown: string | undefined
    }
}