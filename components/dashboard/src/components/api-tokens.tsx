/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import IconButton from '@material-ui/core/IconButton';
import Input from '@material-ui/core/Input';
import TableCell from '@material-ui/core/TableCell';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import Typography from '@material-ui/core/Typography';
import Table from '@material-ui/core/Table';
import CheckIcon from '@material-ui/icons/Check';
import Delete from '@material-ui/icons/Delete';
import FileCopyIcon from '@material-ui/icons/FileCopy';
import { GitpodService, GitpodToken, GitpodTokenType, Permission } from '@gitpod/gitpod-protocol';
import * as React from 'react';

export interface ApiTokenViewProps {
    service: GitpodService;
}

interface ApiTokenViewState {
    hasApiPermission?: boolean;
    tokens: GitpodToken[];
    showDialog?: "delete_confirmation" | "new" | "error";
    tokenHash?: string;
    token?: string;
    tokenName?: string;
    created?: string;
    copied?: boolean;
    error?: string;
}

export class ApiTokenView extends React.Component<ApiTokenViewProps, ApiTokenViewState> {

    protected apiTokenElement: HTMLSpanElement | null;

    constructor(props: ApiTokenViewProps) {
        super(props);
        this.state = { hasApiPermission: false, tokens: [] };
    }

    componentWillMount() {
        this.initState();
    }

    protected async initState() {
        const hasApiPermission = await this.hasApiPermission();
        if(hasApiPermission) {
            this.updateTokens();
        }
        this.setState({ hasApiPermission });
    }

    protected async hasApiPermission() {
        return this.props.service.server.hasPermission({
            permission: Permission.ADMIN_API,
        });
    }

    render() {
        if (!this.state.hasApiPermission) {
            return <div></div>;
        }
        return <React.Fragment>
            <h3 style={{ marginTop: 50 }}>API Tokens</h3>

            <Dialog open={!!this.state.showDialog}>

                {this.state.showDialog === "delete_confirmation" && <React.Fragment>
                    <DialogTitle>Do you really want to delete this token?</DialogTitle>
                    <DialogContent>
                        <Typography variant="body1" style={{ width: "100%" }}>
                            <div>Token {this.state.tokenName ? "“" + this.state.tokenName + "”" : ""} with creation date {new Date(this.state.created!).toLocaleString()} will be removed.</div>
                        </Typography>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => this.setState({ showDialog: undefined, tokenHash: undefined })} variant="outlined" color="primary">Cancel</Button>
                        <Button onClick={() => {
                            const hash = this.state.tokenHash;
                            this.setState({showDialog: undefined, tokenHash: undefined, tokenName: undefined, created: undefined});
                            this.deleteToken(hash!);
                        }} variant="outlined" color="secondary" >
                            Delete Token
                        </Button>
                    </DialogActions>
                </React.Fragment>}

                {this.state.showDialog === "new" && <React.Fragment>
                    <DialogTitle>Create New Token</DialogTitle>
                    <DialogContent>
                        <Typography variant="body1" style={{ width: "100%" }}>

                            <Input
                                id="token-name"
                                placeholder="Token name (optional)"
                                aria-label="Token name (optional)"
                                onChange={(evt) => this.setState({ tokenName: evt.currentTarget.value })}
                                disabled={!!this.state.token}
                                fullWidth={true}
                                autoFocus={true}
                                onKeyPress={(evt) => evt.key === 'Enter' && this.generateNewToken(this.state.tokenName)}
                            />

                            {!!this.state.token &&
                                <div>
                                    <p>
                                        <span style={{ fontWeight: "bold", marginRight: "1em" }}>Token:</span>
                                        <span id="apitoken" ref={(span) => this.apiTokenElement = span}
                                            style={{ fontFamily: "monospace", paddingLeft: ".5em", paddingRight: ".5em" }}>
                                            {this.state.token}
                                        </span>
                                        <IconButton title="Copy token to clipboard" onClick={() => this.copyToken()}>
                                            {this.state.copied ? <CheckIcon /> : <FileCopyIcon />}
                                        </IconButton>
                                    </p>
                                    <p>
                                        This is your new API token. Copy this token now.
                                        For security reasons, we are not able to show this token again once you have closed this dialog.
                                    </p>
                                </div>
                            }
                        </Typography>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => this.setState({ showDialog: undefined, token: undefined, tokenName: undefined })} variant="outlined" color="primary">{!!this.state.token ? "Close" : "Cancel"}</Button>
                        {!this.state.token && <Button onClick={() => this.generateNewToken(this.state.tokenName)} variant="outlined" color="secondary">Generate Token</Button>}
                    </DialogActions>
                </React.Fragment>}

                {this.state.showDialog === "error" && <React.Fragment>
                    <DialogTitle>Error</DialogTitle>
                    <DialogContent>
                        <Typography variant="body1" style={{ width: "100%" }}>
                            <div>{this.state.error}</div>
                        </Typography>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => this.setState({ showDialog: undefined, error: undefined })} variant="outlined" color="primary">Close</Button>
                    </DialogActions>
                </React.Fragment>}

            </Dialog>

            {this.state.tokens.length > 0 &&
                <Table style={{ tableLayout: 'fixed' }}>
                    <TableHead>
                        <TableRow>
                            <TableCell style={{ width: "auto" }}>Created</TableCell>
                            <TableCell style={{ width: "auto" }}>Name</TableCell>
                            <TableCell style={{ width: 106, padding: 4 }}></TableCell>
                        </TableRow>
                    </TableHead>
                    {this.state.tokens.map(token => {
                        return <TableRow key={"token-" + token.tokenHash}>
                            <TableCell>{new Date(token.created).toLocaleString()}</TableCell>
                            <TableCell>{token.name}</TableCell>
                            <TableCell><IconButton className="delete-button" onClick={() => this.setState({showDialog: "delete_confirmation", tokenHash: token.tokenHash, tokenName: token.name, created: token.created})} title="Delete token">
                                <Delete />
                            </IconButton></TableCell>
                        </TableRow>;
                    })}
                </Table>
            }
            {this.state.tokens.length < 1 &&
                <Typography variant="body1" style={{ width: "100%" }}>You do not have any active API tokens. Click on “Add New Token” to generate one.</Typography>
            }
            <div style={{ marginTop: "1.5em" }}>
                <Button onClick={() => this.setState({ showDialog: "new", token: undefined })} color="secondary" variant="outlined">Add New Token</Button>
            </div>
        </React.Fragment>;
    }

    protected async generateNewToken(tokenName: string | undefined) {
        const token = await this.props.service.server.generateNewGitpodToken({ name: tokenName, type: GitpodTokenType.API_AUTH_TOKEN });
        this.setState({ token });
        await this.updateTokens();
    }

    protected async deleteToken(tokenHash: string) {
        try {
            await this.props.service.server.deleteGitpodToken({tokenHash});
            await this.updateTokens();
        } catch (e) {
            this.setState({error: e.toString(), showDialog: "error"});
        }
    }

    protected copyToken() {
        if (!!this.state.token && !!this.apiTokenElement) {
            const range = document.createRange();
            range.selectNode(this.apiTokenElement);
            const selection = window.getSelection();
            if (selection) {
                selection.removeAllRanges();
                selection.addRange(range);
                document.execCommand('copy');
                this.setState({ copied: true });
                setTimeout(() => this.setState({ copied: false }), 1000);
                selection.removeAllRanges();
            }
        }
    }

    protected async updateTokens() {
        const tokens = ((await this.props.service.server.getGitpodTokens({}))||[]).filter(token => token.type === GitpodTokenType.API_AUTH_TOKEN);
        this.setState({ tokens });
    }
}