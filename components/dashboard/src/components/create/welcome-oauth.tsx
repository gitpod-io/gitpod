/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import "reflect-metadata";
import * as React from 'react';

import Button from "@material-ui/core/Button";
import { Deferred } from "@gitpod/gitpod-protocol/lib/util/deferred";
import { ApplicationFrame } from "../page-frame";

export class WelcomeOauthProps {
    contextUrl?: string;
    moveOn: Deferred<void>;
}

export class WelcomeOauth extends React.Component<WelcomeOauthProps, {}> {

    render() {
        let buttonLabel = 'Login';
        const contextUrl = this.props.contextUrl || '';
        if (contextUrl.includes('github.com/')) {
            buttonLabel = "Login with GitHub";
        }
        if (contextUrl.includes('gitlab.com/')) {
            buttonLabel = "Login with GitLab";
        }
        if (contextUrl.includes('bitbucket.org/')) {
            buttonLabel = "Login with Bitbucket";
        }
        return <ApplicationFrame>
            <div style={{ textAlign: 'center' }}>
                <h1 style={{ marginBlockEnd: '5px' }}>Hey there,</h1>
                <h1 style={{ fontWeight: 'bold', marginBlockStart: '5px' }}>Are you Ready-To-Code?</h1>
                <div style={{display: 'flex', justifyContent: 'center'}}>
                    <p style={{ width: '50%' }}>Gitpod launches ready-to-code dev environments for your GitHub, GitLab, or Bitbucket project with a single click.</p>
                </div>
                <Button
                    variant='outlined' color='secondary' onClick={() => this.props.moveOn.resolve()}
                    style={{ margin: '18px' }}
                >{buttonLabel} &amp; Launch Workspace</Button>
            </div>
            <div style={{marginTop: '20px'}}>
                <img src='images/screenshot-theia.png' style={{width:'100%'}}></img>
            </div>
        </ApplicationFrame>;
    }
}
