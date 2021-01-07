/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { GitpodService, User } from "@gitpod/gitpod-protocol";
import * as React from 'react';
import Typography from "@material-ui/core/Typography";
import Button from "@material-ui/core/Button";
import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
import CircularProgress from "@material-ui/core/CircularProgress";
import TextField from "@material-ui/core/TextField";
import { GitpodHostUrl } from "@gitpod/gitpod-protocol/lib/util/gitpod-host-url";

export interface DeleteAccountViewProps {
    service: GitpodService;
    user: User;
}

type DeletionStatus = "confirmation" | "in-progress" | "done" | "error";
interface DeleteAccountViewState {
    status?: DeletionStatus;
    enteredUsername?: string;
}

export class DeleteAccountView extends React.Component<DeleteAccountViewProps, DeleteAccountViewState> {

    constructor(props: DeleteAccountViewProps) {
        super(props);
        this.state = {};
    }

    render() {
        return <React.Fragment>
            <Dialog open={!!this.state.status}>
                {this.state.status === "confirmation" && <React.Fragment>
                    <DialogTitle>We are sorry to see you go.</DialogTitle>
                    <DialogContent>
                        <Typography variant="body1" style={{ width: "100%" }}>
                            <div><i>Beware:</i> unexpected bad things will happen if you don't read this!</div>
                            <div>
                                <ul>
                                    <li>Deleting your account will delete all of your old workspaces. Once your account is deleted we can no longer restore those workspaces.</li>
                                    <li>If you bought a subscription through GitHub, please cancel your current plan in the GitHub marketplace once you have deleted your account.</li>
                                </ul>
                            </div>
                            <div>
                                Please type in your username <b>{this.props.user.name}</b> to confirm: <br />
                                <TextField value={this.state.enteredUsername} onChange={e => this.setState({ enteredUsername: (e.target as HTMLInputElement).value })} />
                            </div>
                        </Typography>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => this.setState({ status: undefined })} variant="outlined" color="primary">Cancel</Button>
                        <Button
                            onClick={() => this.deleteAccount()} variant="outlined"
                            color="secondary" disabled={this.props.user.name !== this.state.enteredUsername}>
                            I'm Sure. Delete My Account!
                </Button>
                    </DialogActions>
                </React.Fragment>}

                {this.state.status === "in-progress" && <React.Fragment>
                    <DialogTitle>We are sorry to see you go.</DialogTitle>
                    <DialogContent>
                        <CircularProgress />
                    </DialogContent>
                </React.Fragment>}

                {this.state.status === "done" && <React.Fragment>
                    <DialogTitle>We are sorry to see you go.</DialogTitle>
                    <DialogContent>
                        <Typography variant="body1">
                            <div>Your account has been deleted and your browser will be redirected to the logout.</div>
                            <div>Feel free to try out Gitpod again. No hard feelings 🙂</div>
                        </Typography>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => this.doLogout()} color="secondary" variant="outlined">Goodbye!</Button>
                    </DialogActions>
                </React.Fragment>}

                {this.state.status === "error" && <React.Fragment>
                    <DialogTitle>Something went wrong.</DialogTitle>
                    <DialogContent>
                        <Typography variant="body1">
                            <div>We are sorry – something went wrong while deleting your account.</div>
                            <div>Please get in touch at <a href="mailto:support@gitpod.io">support@gitpod.io</a>.</div>
                            <div>As a precaution, your browser will still be redirected to the logout.</div>
                        </Typography>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => this.doLogout()} color="secondary" variant="outlined">Ok</Button>
                    </DialogActions>
                </React.Fragment>}
            </Dialog>

            <div style={{ textAlign: "right", marginTop: '1em' }}>
                <a href="javascript:void(0)" onClick={() => this.setState({ status: "confirmation" })} style={{
                    fontSize: '0.875rem',
                    pointerEvents: this.state.status ? 'none' : 'auto',
                }}>delete my account</a>
            </div>
        </React.Fragment>;
    }

    protected doLogout = () => {
        window.location.href = new GitpodHostUrl(window.location.toString()).withApi({ pathname: '/logout' }).toString();
    };

    protected async deleteAccount() {
        this.setState({ status: "in-progress" });
        try {
            await this.props.service.server.deleteAccount();

            this.setState({ status: "done" });
        } catch (err) {
            console.log(err);
            this.setState({ status: "error" });
        }
    }

}