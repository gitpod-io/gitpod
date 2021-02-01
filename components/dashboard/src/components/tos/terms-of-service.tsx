/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import "reflect-metadata";
import * as React from 'react';
import { getSvgPath } from '../../withRoot';
import AppBar from '@material-ui/core/AppBar';
import Toolbar from '@material-ui/core/Toolbar';
import Checkbox from '@material-ui/core/Checkbox';
import Typography from '@material-ui/core/Typography';
import IconButton from '@material-ui/core/IconButton';
import Avatar from '@material-ui/core/Avatar';
import Fade from '@material-ui/core/Fade';
import { GitpodHostUrl } from '@gitpod/gitpod-protocol/lib/util/gitpod-host-url';
import { Terms } from "@gitpod/gitpod-protocol";
import { ButtonWithProgress } from "../button-with-progress";
import * as Cookies from 'js-cookie';
import { mdRenderer } from './terms-renderer';

export interface TermsOfServiceProps {
    terms: Promise<Terms>;
}
interface TermsOfServiceState {
    isUpdate: boolean;
    flowId: string;
    userInfo?: any;
    terms?: Terms;
    acceptsTos: boolean;
    submitted: boolean;
}
export class TermsOfService extends React.Component<TermsOfServiceProps, TermsOfServiceState> {
    protected gitpodHost = new GitpodHostUrl(window.location.href);

    protected formRef: React.RefObject<HTMLFormElement>;

    constructor(props: TermsOfServiceProps) {
        super(props);
        this.state = {
            isUpdate: false,
            acceptsTos: false,
            submitted: false,
            flowId: "ignore",
        };
        this.formRef = React.createRef();
        this.onDecline = this.onDecline.bind(this);
        this.onAccept = this.onAccept.bind(this);
    }

    componentWillMount() {
        this.onLoad();
    }

    protected async onLoad(): Promise<void> {
        const tosHints = Cookies.getJSON('tosHints');
        this.setState({
            isUpdate: tosHints?.isUpdate === true,
            flowId: typeof tosHints?.flowId === "string" ? tosHints?.flowId : this.state.flowId,
            userInfo: typeof tosHints?.userInfo === "object" ? tosHints?.userInfo : undefined
        });
        this.props.terms.then(terms => this.setState({ terms }));
    }

    protected renderMd(md: string | undefined): string {
        return mdRenderer.render(md || "");
    }

    onAccept() {
        this.setState({ acceptsTos: true, submitted: true }, () => this.doSubmit());
    }
    onDecline() {
        this.setState({ acceptsTos: false, submitted: true }, () => this.doSubmit());
    }
    protected doSubmit() {
        this.formRef.current!.submit();
    }

    protected actionUrl = this.gitpodHost.withApi({ pathname: '/tos/proceed' }).toString();
    render() {
        const acceptsTos = this.state.acceptsTos;
        const update = this.state.isUpdate;

        let tosContentRendered = this.renderMd(update ? this.state.terms?.updateMessage : this.state.terms?.content);

        if (!update && this.state.userInfo?.authHost) {
            tosContentRendered = tosContentRendered.replace("{{AUTH_HOST}}", this.state.userInfo?.authHost);
        }

        let userSection: JSX.Element = <div></div>;
        if (this.state.userInfo) {
            const avatarUrl: string | undefined = this.state.userInfo.avatarUrl;
            const userName: string | undefined = this.state.userInfo.name;
            const abbr = (name: string) => name.split(/(\W)/g).filter(x => x.length > 1).map(x => x[0].toUpperCase()).join("");
            const avatarText = avatarUrl ? null : abbr(userName || "?");
            userSection = (<div>
                <IconButton
                    id="avatar-menu-button"
                    aria-label="Account menu"
                    aria-owns={'account-menu'}
                    aria-haspopup="true"
                    style={{ padding: '0px' }}
                >
                    <Avatar
                        alt={userName}
                        src={avatarUrl}
                        style={{
                            borderRadius: 3
                        }}
                        data-testid={"avatar-" + userName}>
                        {avatarText}
                    </Avatar>
                </IconButton>
            </div>);
            userSection = (
                <Fade in={true}>
                    {userSection}
                </Fade>
            );
        }

        return (
            <div>
                <AppBar position='static'>
                    <Toolbar className="content toolbar">
                        <div className="gitpod-logo">
                            <a href={this.gitpodHost.toString()}>
                                <img src={getSvgPath('/images/gitpod-ddd.svg')} alt="Gitpod Logo" className="logo" />
                            </a>
                        </div>
                        <div style={{ flexGrow: 1 }} />
                        <div className="user-section">{userSection}</div>
                    </Toolbar>
                </AppBar>
                <div className='content content-area'>
                    <form ref={this.formRef} action={this.actionUrl} method="post" id="accept-tos-form">
                        <input type="hidden" id="flowId" name="flowId" value={this.state.flowId} />
                        <div className="tos-checks">
                            <Typography className="tos-content" dangerouslySetInnerHTML={{ __html: tosContentRendered }} />
                            <p>
                                <label style={{ display: 'none', alignItems: 'center' }}>
                                    <Checkbox
                                        value="true"
                                        name="agreeTOS"
                                        checked={acceptsTos}
                                        onChange={() => this.setState({ acceptsTos: !acceptsTos })} />
                                    <span>
                                        I accept the {update ? "updated" : ""} terms and conditions.
                                </span>
                                </label>
                            </p>
                        </div>
                        <div className="tos-buttons" data-testid="tos">
                            {update && (
                                <ButtonWithProgress
                                    className='button'
                                    variant='text'
                                    color={'secondary'}
                                    onClick={this.onDecline}
                                    disabled={this.state.submitted}
                                    data-testid="decline">
                                    {'Decline and log out'}
                                </ButtonWithProgress>
                            )}
                            <ButtonWithProgress
                                className='button'
                                onClick={this.onAccept}
                                disabled={this.state.submitted}
                                variant='outlined'
                                color={'primary'}
                                data-testid="submit">
                                {'Accept to continue'}
                            </ButtonWithProgress>
                        </div>
                    </form>
                </div>
            </div>
        );
    }

}