/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import "reflect-metadata";
import * as React from 'react';

import { createGitpodService } from "../../service-factory";
import ShowGenericError from "../show-generic-error";
import Grid from "@material-ui/core/Grid";
import Paper from "@material-ui/core/Paper";
import Typography from "@material-ui/core/Typography";
import Button from "@material-ui/core/Button";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemText from "@material-ui/core/ListItemText";
import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import DialogContentText from "@material-ui/core/DialogContentText";
import DialogActions from "@material-ui/core/DialogActions";
import { GitpodHostUrl } from "@gitpod/gitpod-protocol/lib/util/gitpod-host-url";
import { ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { ResponseError } from "vscode-jsonrpc";

interface InstallGithubAppState {
    isLoggedIn: boolean;
    enableForPrivateRepos: boolean;
    showDialog: 'none' | 'cancel' | 'errorWhenReg' | 'done';
}

export class InstallGithubApp extends React.Component<{}, InstallGithubAppState> {
    private service = createGitpodService();
    protected readonly installationId: string | undefined;

    constructor(props: {}) {
        super(props);

        const params = new URLSearchParams(window.location.search);
        this.installationId = params.get("installation_id") || undefined;
        let showDialog: "none" | "done" = 'none';
        if (params.get("done")) {
            showDialog = 'done';
        }

        this.state = {
            isLoggedIn: false,
            enableForPrivateRepos: true,
            showDialog
        };
    }

    async componentWillMount() {
        try {
            await this.service.server.getLoggedInUser({});
            this.setState({ isLoggedIn: true });
        } catch (e) {
            if (e instanceof ResponseError) {
                switch (e.code) {
                    case ErrorCodes.SETUP_REQUIRED:
                        window.location.href = new GitpodHostUrl(window.location.toString()).with({ pathname: "first-steps" }).toString();
                        break;
                    case ErrorCodes.NOT_AUTHENTICATED:
                        let url = new GitpodHostUrl(window.location.toString()).withApi({
                            pathname: '/login/',
                            search: 'returnTo=' + encodeURIComponent(window.location.toString())
                        }).toString();
                        window.location.href = url.toString();
                        break;
                    default:
                }
            }

            console.error('Error during getLoggedInUser', e);
        }
    }

    render() {
        if (!this.state.isLoggedIn) {
            return (
                <Paper style={{ padding: 30, minHeight: 225 }} className="loading-skeleton">
                    <Grid container>
                        <Grid item xs={12} />
                    </Grid>
                </Paper>
            );
        }

        let content: JSX.Element;
        if (!this.installationId) {
            content = <ShowGenericError errorMessage="No installation_id parameter present. Are you sure you have come from GitHub?" />;
        } else {
            content = (
                <Paper style={{ padding: 30 }}>
                    <Grid container>
                        <Grid item xs={12}>
                            <Typography variant="headline">Install GitHub app</Typography>
                            <List>
                                <ListItem style={{ paddingLeft: '0px' }}>
                                    <ListItemText>
                                        You are about to install the GitHub app for Gitpod.
                                        That's a great idea because it makes Gitpod even better for you and everyone else who contributes to your repositories.
                                    </ListItemText>

                                </ListItem>
                                <ListItem style={{ paddingLeft: '0px' }}>
                                    <ListItemText>
                                        <b>Note:</b> If you want to use prebuilt workspaces for private repositories, your Gitpod user needs access to those repositories.
                                    Use the <a href="/access-control/" target="_blank" rel="noopener">Access Control</a> page to configure what Gitpod has access to.
                                    </ListItemText>
                                </ListItem>
                            </List>
                        </Grid>

                        <Grid item xs={8} />
                        <Grid item xs={4} style={{ textAlign: 'right' }}>
                            <Button className="button" variant="outlined" color="primary" style={{ marginRight: '10px' }} onClick={() => this.setState({ showDialog: 'cancel' })}>Cancel</Button>
                            <Button className="button" variant="outlined" color="secondary" onClick={this.registerApp.bind(this, this.installationId)}>Install</Button>
                        </Grid>
                    </Grid>
                </Paper>
            );
        }

        const thisUrl = new GitpodHostUrl(new URL(window.location.toString()));
        return (
            <React.Fragment>
                {content}
                <Dialog open={this.state.showDialog === 'cancel'}>
                    <DialogTitle>Cancel installation?</DialogTitle>
                    <DialogContent>
                        <DialogContentText>Canceling the installation here just prevents Gitpod from reacting to the events it receives from GitHub.
                        To fully undo the installation, please uninstall the <a href={`https://github.com/settings/installations/${this.installationId}`} target="_blank" rel="noopener noreferrer">Gitpod app in GitHub</a>.</DialogContentText>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => this.setState({ showDialog: 'none' })} variant="outlined" color="primary">Abort</Button>
                        <Button onClick={() => window.location.href = `https://github.com/settings/installations/${this.installationId}`} variant="outlined" color="secondary" autoFocus>Ok</Button>
                    </DialogActions>
                </Dialog>
                <Dialog open={this.state.showDialog === 'errorWhenReg'}>
                    <DialogTitle>Error while installing the app</DialogTitle>
                    <DialogContent>
                        <DialogContentText>Could not register the app with Gitpod - there seems to be a network issue. Please try again in a moment.</DialogContentText>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => this.setState({ showDialog: 'none' })} variant="outlined" color="secondary" autoFocus>Ok</Button>
                    </DialogActions>
                </Dialog>
                <Dialog open={this.state.showDialog === 'done'}>
                    <DialogTitle>Installation successful</DialogTitle>
                    <DialogContent>
                        <DialogContentText>The GitHub app was installed successfully. Have a look at the <a href="https://www.gitpod.io/docs/prebuilds/" target="_blank" rel="noopener">documentation</a> to find out how to configure it.</DialogContentText>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => window.location.href = thisUrl.asDashboard().toString()} variant="outlined" color="secondary" autoFocus>Ok</Button>
                    </DialogActions>
                </Dialog>
            </React.Fragment>
        );
    }

    protected async registerApp(installationId: string) {
        try {
            await this.service.server.registerGithubApp({installationId});

            const thisUrl = new GitpodHostUrl(new URL(window.location.toString()));
            const returnTo = encodeURIComponent(thisUrl.with({ search: `installation_id=${installationId}&done=true` }).toString());
            window.location.href = thisUrl.withApi({
                pathname: '/authorize',
                search: `returnTo=${returnTo}&host=github.com&scopes=repo`
            }).toString();
        } catch (err) {
            console.error("Error while installing app", err);
            this.setState({ showDialog: 'errorWhenReg' });
        }
    }

}