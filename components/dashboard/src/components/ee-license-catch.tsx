/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */


import * as React from 'react';
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog/Dialog';
import DialogTitle from '@material-ui/core/DialogTitle';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import { ResponseError } from 'vscode-jsonrpc';
import { ErrorCodes } from '@gitpod/gitpod-protocol/lib/messaging/error';
import { GitpodHostUrl } from '@gitpod/gitpod-protocol/lib/util/gitpod-host-url';

export interface EELicenseCatchProps {}

interface EELicenseCatchState {
    showDialog: 'none' | 'ee-feature' | 'ee-license-req';
    message?: string;
}

export class EELicenseCatch extends React.Component<EELicenseCatchProps, EELicenseCatchState> {

    constructor(props: EELicenseCatchProps) {
        super(props);
        this.state = {
            showDialog: 'none',
        };
    }

    public componentDidCatch(err: Error) {
        if (!(err instanceof ResponseError)) {
            throw err;
        }

        switch (err.code) {
            case ErrorCodes.EE_FEATURE:
                this.setState({showDialog: 'ee-feature', message: err.message});
                break;
            case ErrorCodes.EE_LICENSE_REQUIRED:
                this.setState({showDialog: 'ee-license-req', message: err.message});
                break;
            default:
        }
    }

    render() {
        if (this.state.showDialog === 'ee-feature') {
            return [
                // once we find a way to prevent the children from re-triggering the same error
                // that we just caught we can also render the children back in.

                // this.props.children,
                <Dialog open={true} key="ee-feature-dialog">
                    <DialogTitle>You have found an enterprise feature</DialogTitle>
                    <DialogContent>
                        which is not implemented in this installation of Gitpod. To use it, please install <a href="https://gitpod.io">Gitpod Enterprise Edition</a>.
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => this.closeDialog()}>Close</Button>
                    </DialogActions>
                </Dialog>,
            ];
        }
        if (this.state.showDialog === 'ee-license-req') {
            const link = new GitpodHostUrl(window.location.toString()).with({ pathname: "license"}).toString();
            const dashboardLink = new GitpodHostUrl(window.location.toString()).asDashboard().toString();
            return [
                // once we find a way to prevent the children from re-triggering the same error
                // that we just caught we can also render the children back in.

                // this.props.children,
                <Dialog open={true} key="ee-license-req-dialog">
                    <DialogTitle>You have found an enterprise feature</DialogTitle>
                    <DialogContent>
                        which requires a license. Just head over to the <a href={link}>license</a> page and we'll guide you through the process.
                    </DialogContent>
                    <DialogActions>
                        <Button href={dashboardLink}>Dismiss</Button>
                        <Button href={link} color="secondary">Show License</Button>
                    </DialogActions>
                </Dialog>,
            ];
        }

        return this.props.children;
    }

    protected closeDialog() {
        this.setState({showDialog: 'none', message: undefined});
    }

}