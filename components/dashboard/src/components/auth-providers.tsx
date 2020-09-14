/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as React from 'react';
import { User, GitpodService, AuthProviderEntry } from "@gitpod/gitpod-protocol";
import TextField from '@material-ui/core/TextField';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import MenuItem from '@material-ui/core/MenuItem';
import Select from '@material-ui/core/Select';
import InputLabel from '@material-ui/core/InputLabel';
import Input from '@material-ui/core/Input';
import FormControl from '@material-ui/core/FormControl';
import Button from '@material-ui/core/Button';
import IconButton from '@material-ui/core/IconButton';
import InputAdornment from '@material-ui/core/InputAdornment';
import FileCopyIcon from '@material-ui/icons/FileCopy';
import Info from '@material-ui/icons/Info';
import Delete from '@material-ui/icons/Delete';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';
import Tooltip from '@material-ui/core/Tooltip';
import Avatar from '@material-ui/core/Avatar';
import Grid from '@material-ui/core/Grid';
import { themeMode } from '../withRoot';
import { GitpodHostUrl } from '@gitpod/gitpod-protocol/lib/util/gitpod-host-url';

export class AuthProvidersProps {
    service: GitpodService;
    user?: User;
    mode: "initial-setup" | "user-settings";
}

export class AuthProvidersState {
    ownAuthProviders: AuthProviderEntry[];
    addDialog?: {
        type: string,
        host: string,
        errorMessage?: string,
    };
    saveDialog?: {
        status: "in-progress" | "done" | "error"
        errorMessage?: string,
        host: string,
    };
    deleteDialog?: {
        host: string,
    };
}

export class AuthProviders extends React.Component<AuthProvidersProps, AuthProvidersState> {

    constructor(props: AuthProvidersProps) {
        super(props);
        this.state = {
            ownAuthProviders: [],
        };
    }

    componentWillMount() {
        this.update();
    }

    componentDidUpdate(prevProps: AuthProvidersProps) {
        if (!this.noUserMode && this.props.user !== prevProps.user) {
            this.update();
        }
    }

    protected get noUserMode(): boolean {
        return this.props.mode === "initial-setup";
    }

    protected async update() {
        if (!this.noUserMode && !this.props.user) {
            return;
        }
        const ownAuthProviders = await this.props.service.server.getOwnAuthProviders({});
        this.setState({ ownAuthProviders });
    }

    protected deleteAuthProvider = async (ap: AuthProviderEntry) => {
        const { host } = ap;
        this.setState({
            deleteDialog: {
                host
            }
        });
    };

    protected doDeleteAuthProvider = async () => {
        const host = this.state.deleteDialog && this.state.deleteDialog.host;
        if (!host) {
            return;
        }
        const ap = this.state.ownAuthProviders.find(p => p.host === host);
        if (!ap) {
            return;
        }
        try {
            await this.props.service.server.deleteOwnAuthProvider(ap);
        } catch (error) {
            console.error(error);
        }
        this.setState({ deleteDialog: undefined });
        this.update();
    };

    protected updateAuthProvider = async ({ host }: AuthProviderEntry, entry: AuthProviderEntry.UpdateEntry) => {
        this.setState({
            saveDialog: {
                status: "in-progress",
                host,
            }
        });
        try {
            await this.props.service.server.updateOwnAuthProvider({ entry });

            // just wait a sec for the changes to be propagated
            await new Promise(resolve => setTimeout(resolve, 2001));

            this.setState({
                saveDialog: {
                    status: "done",
                    host,
                }
            });
        } catch (error) {
            console.error(error);
            this.setState({
                saveDialog: {
                    host,
                    status: "error",
                    errorMessage: "message" in error ? error.message : "Failed to update Git provider"
                }
            });
        }
        this.update();
    };

    protected activateAuthProvider = () => {
        const host = this.state.saveDialog && this.state.saveDialog.host;
        if (!host) {
            return;
        }
        this.tryToConnectInNewTab(host);
        this.pollState(host);
    };
    protected tryToConnectInNewTab(host: string) {
        const hostUrl = new GitpodHostUrl(window.location.toString());
        const accessControlUrl = hostUrl.asAccessControl();
        const returnToAccessControlUrl = accessControlUrl.with({ search: `updated=${host}` }).toString();
        const search = `returnTo=${encodeURIComponent(returnToAccessControlUrl)}&host=${host}&connect=1`;
        const url = hostUrl.withApi({
            pathname: this.noUserMode ? '/login' : '/authorize',
            search
        }).toString();
        window.open(url, "_blank");
    }

    protected async pollState(host: string, round: number = 0) {
        const hostChanged = () => {
            const currentHost = this.state.saveDialog && this.state.saveDialog.host;
            return currentHost !== host;
        };
        await new Promise(resolve => setTimeout(resolve, 1000));
        if (hostChanged()) {
            return;
        }
        if (this.noUserMode) {
            try {
                const uri = new GitpodHostUrl(window.location.toString())
                    .withApi(url => ({ pathname: '/refresh-login' }))
                    .toString();
                await fetch(uri, { credentials: 'include' });

                // if refresh-login succeeded, redirect asap
                window.location.href = new GitpodHostUrl(window.location.toString()).asDashboard().toString();
            } catch {
                console.log(`User is still not logged in.`);
            }
        } else {
            await this.update();
            if (hostChanged()) {
                return;
            }
            const ap = this.state.ownAuthProviders.find(p => p.host === host);
            if (!ap) {
                return;
            }
            if (ap.status === "verified") {
                this.closeSaveDialog();
                return;
            }
        }

        if (round < 180) {
            await this.pollState(host, round + 1);
        }
    }

    protected closeSaveDialog = () => {
        this.setState({
            saveDialog: undefined
        });
    };

    protected showAddDialog = () => {
        this.setState({
            addDialog: {
                type: "GitLab",
                host: "gitlab.com"
            }
        });
    };
    protected closeAddDialog = () => {
        this.setState({
            addDialog: undefined
        });
    };

    protected addAuthProvider = async () => {
        const addDialogContent = this.state.addDialog;
        const user = this.props.user;
        if ((!this.noUserMode && !user) || !addDialogContent) {
            return;
        }
        const { host, type } = addDialogContent;

        try {
            const entry: AuthProviderEntry.NewEntry = {
                host,
                type,
                ownerId: this.noUserMode ? "no-user" : (user ? user.id : "missing-user-id"),
            };

            await this.props.service.server.updateOwnAuthProvider({ entry });
            this.setState({
                addDialog: undefined
            });
        } catch (error) {
            console.error(error);
            this.setState({
                addDialog: {
                    host,
                    type,
                    errorMessage: "message" in error ? error.message : "Failed to update Git provider"
                }
            });
        }
        this.update();
    };

    protected readonly onChangeAddDialogHost = (e: React.ChangeEvent<HTMLInputElement>) => {
        const host = e.target.value!;
        this.setState(prevState => ({
            addDialog: {
                host,
                type: prevState.addDialog!.type,
                errorMessage: undefined
            }
        }));
    };
    protected readonly onChangeAddDialogType = (event: React.ChangeEvent<{ value: string }>) => {
        const type = event.target.value;
        const reconcileHost = (prevHost: string, newType: string) => {
            if (prevHost === "github.com" && newType === "GitLab") {
                return "gitlab.com";
            }
            if (prevHost === "gitlab.com" && newType === "GitHub") {
                return "github.com";
            }
            return prevHost;
        };
        this.setState(prevState => ({
            addDialog: {
                host: reconcileHost(prevState.addDialog!.host, type),
                type
            }
        }));
    };
    protected readonly handleKeyUp = (e: React.KeyboardEvent<HTMLElement>) => {
        if (e.key === "Enter") {
            const { addDialog } = this.state;
            if (addDialog && addDialog.host && !addDialog.errorMessage) {
                this.addAuthProvider();
            }
        } else if (e.key === "Escape") {
            this.closeAddDialog();
        }
    }

    render() {
        const { ownAuthProviders, addDialog, saveDialog, deleteDialog } = this.state;
        const showAddButton = !this.noUserMode || ownAuthProviders.length === 0;
        const showAddDialog = !!addDialog;
        const showSaveDialog = !!saveDialog;
        const showDeleteDialog = !!deleteDialog;
        return (
            <React.Fragment>
                {addDialog &&
                    <Dialog open={showAddDialog} onKeyUp={this.handleKeyUp} maxWidth={"xs"} fullWidth={true}>
                        <DialogTitle>Add a Git Provider</DialogTitle>
                        <DialogContent>
                            <div>
                                <p>
                                    <FormControl style={{ width: "98%" }}>
                                        <InputLabel id="type-label" htmlFor="type">
                                            Type
                                    </InputLabel>
                                        <Select id="type-select"
                                            value={addDialog.type}
                                            onChange={this.onChangeAddDialogType}
                                            margin="dense"
                                            input={<Input name="type" id="type-label-placeholder" />}
                                        >
                                            <MenuItem value={"GitHub"}>GitHub</MenuItem>
                                            <MenuItem value={"GitLab"}>GitLab</MenuItem>
                                        </Select>
                                    </FormControl>
                                </p>
                                <p>
                                    <TextField style={{ width: "98%" }}
                                        label="Git Provider's host name"
                                        value={addDialog.host || ""}
                                        placeholder={"gitlab.awesome.org"}
                                        onChange={this.onChangeAddDialogHost}
                                        error={addDialog.errorMessage !== undefined}
                                        helperText={addDialog.errorMessage}
                                        fullWidth
                                        InputLabelProps={{
                                            focused: false
                                        }}
                                        margin="dense"
                                    />
                                </p>

                            </div>
                        </DialogContent>
                        <DialogActions style={{ paddingRight: "10px" }}>
                            <Button onClick={this.closeAddDialog} variant="outlined" color="primary">Cancel</Button>
                            <Button onClick={this.addAuthProvider} variant="outlined" color="secondary" disabled={!addDialog.host || !!addDialog.errorMessage}>Add</Button>
                        </DialogActions>
                    </Dialog>}
                {saveDialog &&
                    <Dialog open={showSaveDialog} maxWidth={"sm"} fullWidth={true}>
                        <DialogTitle>{this.showSaveDialogTitle(this.state)}</DialogTitle>
                        <DialogContent>
                            <div>
                                <p style={{ width: "98%" }}>
                                    To activate this Git Provider please connect to it yourself.
                            </p>
                                <p style={{ width: "98%" }}>
                                    Select <strong>Connect</strong> to initiate a test in a new tab.
                            </p>
                            </div>
                        </DialogContent>
                        <DialogActions style={{ paddingRight: "10px" }}>
                            <Button onClick={this.closeSaveDialog} variant="outlined" color="primary">Close</Button>
                            <Button onClick={this.activateAuthProvider} variant="outlined" color="secondary" disabled={!saveDialog || saveDialog.status !== "done"}>
                                Connect
                            </Button>
                        </DialogActions>
                    </Dialog>}
                {deleteDialog &&
                    <Dialog open={showDeleteDialog} maxWidth={"sm"} fullWidth={true}>
                        <DialogTitle>Are you sure?</DialogTitle>
                        <DialogContent>
                            <div>
                                <p style={{ width: "95%" }}>
                                    Deleting the Git Provider for <strong>{deleteDialog.host}</strong> will disable the Git repository authorizations for <strong>all connected users</strong>.
                                </p>
                            </div>
                        </DialogContent>
                        <DialogActions style={{ paddingRight: "10px" }}>
                            <Button onClick={() => this.setState({ deleteDialog: undefined })} variant="outlined" color="primary">Cancel</Button>
                            <Button onClick={this.doDeleteAuthProvider} variant="outlined" color="secondary">Delete</Button>
                        </DialogActions>
                    </Dialog>}
                {ownAuthProviders.length === 0 && (
                    <Typography>
                        Click "Add Git Provider" to enable access to your organization's repositories. <a href="https://www.gitpod.io/docs/configuration/" target="_blank" rel="noopener">Learn more</a>
                    </Typography>
                )}
                {ownAuthProviders.map(ap => {
                    return (
                        <AuthProviderComponent key={this.computeKey(ap)} ap={ap} delete={this.deleteAuthProvider} update={this.updateAuthProvider} />
                    );
                })}
                {showAddButton && (
                    <div style={{ marginTop: "1.5em" }}>
                        <Button onClick={this.showAddDialog} color="secondary" variant="outlined">Add Git Provider</Button>
                    </div>
                )}
            </React.Fragment>
        );
    }
    protected showSaveDialogTitle(state: Readonly<AuthProvidersState>) {
        if (state.saveDialog) {
            switch (state.saveDialog.status) {
                case "in-progress": return "Saving Changes";
                case "done": return "Activation Required";
                case "error": return "Request Failed";
                default: return undefined;
            }
        }
        return undefined;
    }

    private computeKey(ap: Partial<AuthProviderEntry>) {
        return `AuthProviderEntry-${ap.id}-${ap.host}`;
    }
}

interface AuthProviderComponentProps {
    ap: AuthProviderEntry;
    delete?: (ap: AuthProviderEntry) => void;
    update: (ap: AuthProviderEntry, update: AuthProviderEntry.UpdateEntry) => void;
}

interface AuthProviderComponentState {
    clientId: string;
    clientSecret: string;
}

export class AuthProviderComponent extends React.Component<AuthProviderComponentProps, AuthProviderComponentState> {

    constructor(props: AuthProviderComponentProps) {
        super(props);
        this.save = this.save.bind(this);
        this.delete = this.delete.bind(this);
        const { clientId } = props.ap.oauth;
        this.state = {
            clientId: !clientId || clientId === "no" ? "" : clientId,
            clientSecret: ""
        };
    }

    protected save() {
        const { id, ownerId } = this.props.ap;
        const { clientId, clientSecret } = this.state;

        // we may send empty client secret from intial state init, which is treated as unchanged on BE
        this.props.update(this.props.ap, { id, ownerId, clientId, clientSecret });
    }
    protected delete() {
        if (this.props.delete) {
            this.props.delete(this.props.ap);
        }
    }

    protected readonly clientIdChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
        this.setState({ clientId: e.target.value });
    };
    protected readonly clientSecretChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
        this.setState({ clientSecret: e.target.value });
    };
    protected readonly copyCallbackUrl = () => {
        const el = document.createElement("textarea");
        el.value = this.props.ap.oauth.callBackUrl;
        document.body.appendChild(el);
        el.select();
        try {
            document.execCommand("copy");
        } finally {
            document.body.removeChild(el);
        }
    };

    protected redirectUrlTooltip = (<p>Use this <strong>Redirect URL</strong> to update the OAuth App.</p>);
    protected clientIdTooltip = (<p>Paste the <strong>Client ID</strong> of the OAuth App here.</p>);
    protected clientSecretTooltip = (<p>Paste the <strong>Client Secret</strong> of the OAuth App here.</p>);
    protected label = (title: string | JSX.Element | undefined, tooltip?: JSX.Element) => (<React.Fragment>
        <Typography style={{ margin: "10px", display: "inline-block" }}>
            {title}
            {tooltip && (
                <Tooltip leaveDelay={1000} placement="top" style={{ margin: 5 }} title={tooltip}>
                    <Info fontSize="small" color="disabled" style={{ verticalAlign: 'middle', marginLeft: "8px" }} />
                </Tooltip>
            )}
        </Typography>
    </React.Fragment>);

    protected getIcon(type: string) {
        switch (type) {
            case "GitHub": return themeMode === 'light' ? "/images/github.svg" : "/images/github.dark.svg";
            case "GitLab": return themeMode === 'light' ? "/images/gitlab.svg" : "/images/gitlab.dark.svg";
            default: return undefined;
        }
    }
    protected getNotice(type: string, host: string) {
        switch (type) {
            case "GitHub":
                return (<Typography>
                    Go to <a href={`https://${host}/settings/developers`} target="_blank" rel="noopener">{host}/settings/developers</a> to setup the OAuth application.&nbsp;
                    <a href="https://www.gitpod.io/docs/github-integration/#oauth-application" target="_blank" rel="noopener">Learn more</a>.
                    </Typography>);
            case "GitLab":
                return (<Typography>
                    Go to <a href={`https://${host}/profile/applications`} target="_blank" rel="noopener">{host}/profile/applications</a> to setup the OAuth application.&nbsp;
                    <a href="https://www.gitpod.io/docs/gitlab-integration/#oauth-application" target="_blank" rel="noopener">Learn more</a>.
                    </Typography>);
            default: return undefined;
        }
    }

    render() {
        const dirty = this.state.clientId !== this.props.ap.oauth.clientId
            || this.state.clientSecret !== "";
        const empty = !this.state.clientId || !this.state.clientSecret;
        const unverified = this.props.ap.status === "pending";
        return (
            <Paper style={{ padding: "12px" }} elevation={3}>
                <Grid container style={{ display: "flex" }}>
                    <Grid item xs={10}>
                        <Typography variant="headline" component="h5">
                            <Avatar src={this.getIcon(this.props.ap.type)} style={{ display: "inline-block", verticalAlign: "middle", marginRight: "15px" }} />
                            {this.props.ap.host}
                        </Typography>
                    </Grid>
                    <Grid item xs={2} style={{ textAlign: "right" }}>
                        {this.props.delete && (
                            <IconButton className="delete-button" onClick={this.delete} title="Delete">
                                <Delete fontSize="small" />
                            </IconButton>
                        )}
                    </Grid>
                    <Grid item xs={12} style={{ marginBottom: "20px" }}>
                        {this.label(this.getNotice(this.props.ap.type, this.props.ap.host))}
                    </Grid>
                    <Grid item xs={2}>
                        {this.label("Redirect URL", this.redirectUrlTooltip)}
                    </Grid>
                    <Grid item xs={10}>
                        <TextField
                            value={this.props.ap.oauth.callBackUrl}
                            disabled={true}
                            fullWidth
                            margin="dense"
                            style={{ width: "100%" }}
                            InputProps={{
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton onClick={this.copyCallbackUrl} title="Copy the Redirect URL to clippboard">
                                            <FileCopyIcon fontSize="small" />
                                        </IconButton>
                                    </InputAdornment>
                                ),
                            }}
                        />
                    </Grid>
                    <Grid item xs={2}>
                        {this.label("Client ID", this.clientIdTooltip)}
                    </Grid>
                    <Grid item xs={10}>
                        <TextField
                            value={this.state.clientId || ""}
                            placeholder={"Paste the Client ID here."}
                            onChange={this.clientIdChanged}
                            margin="dense"
                            style={{ width: "100%" }}
                        />
                    </Grid>
                    <Grid item xs={2}>
                        {this.label("Client Secret", this.clientSecretTooltip)}
                    </Grid>
                    <Grid item xs={10}>
                        <TextField
                            value={this.state.clientSecret}
                            placeholder={"Paste the Client Secret here to update."}
                            onChange={this.clientSecretChanged}
                            margin="dense"
                            style={{ width: "100%" }}
                        />
                    </Grid>
                    <Grid item xs={12} style={{ textAlign: "right", marginTop: "12px" }}>
                        {unverified ? this.label("Connect to activate this Git Provider") : ""}
                        <Button onClick={this.save} variant='outlined' color='secondary' disabled={!unverified && (!dirty || empty)}>Connect</Button>
                    </Grid>
                </Grid>
            </Paper >
        );
    }
}