/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import "reflect-metadata";
import * as React from 'react';

import Button from "@material-ui/core/Button";
import { ApplicationFrame } from "../page-frame";

export class NoReferrer extends React.Component<{}, {}> {

    render() {
        return <ApplicationFrame>
            <div className="sorry">
                <h3>No referrer found 😳</h3>
                <h2>It looks like you want to start a workspace, but your referrer is empty</h2>
                <p>Maybe your GitHub repository is private? In this case you have to use the <strong>gitpod.io/#</strong> prefix.</p>
                <p style={{ marginTop: '10px' }}>See <a href="https://github.com/gitpod-io/gitpod/issues/688#issuecomment-514564728">here</a> for details.</p>
                <Button
                    variant='outlined' color='secondary' onClick={() => window.history.back()}
                    style={{ margin: '18px' }}
                >Back to Repository</Button>
            </div>
        </ApplicationFrame>;
    }
}
