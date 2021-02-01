/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as React from 'react';
import Typography from '@material-ui/core/Typography';
import Toolbar from '@material-ui/core/Toolbar';
import Button from '@material-ui/core/Button';
import IconButton from '@material-ui/core/IconButton';
import Checkbox from '@material-ui/core/Checkbox';
import InfoIcon from '@material-ui/icons/Info';
import Tooltip from '@material-ui/core/Tooltip';
import OpenInNewIcon from '@material-ui/icons/OpenInNew';
import Card from '@material-ui/core/Card';
import Grid from '@material-ui/core/Grid';
import CardActions from '@material-ui/core/CardActions';
import CardContent from '@material-ui/core/CardActions';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogContent from '@material-ui/core/DialogContent';
import Dialog from '@material-ui/core/Dialog';
import HighlightOffOutlined from '@material-ui/icons/HighlightOffOutlined';
import DialogTitle from '@material-ui/core/DialogTitle';
import DialogActions from '@material-ui/core/DialogActions';
import { themeMode } from '../../withRoot';
import { GitpodService, AuthProviderInfo, User } from '@gitpod/gitpod-protocol';
import { GitpodHostUrl } from '@gitpod/gitpod-protocol/lib/util/gitpod-host-url';
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { ErrorCodes } from '@gitpod/gitpod-protocol/lib/messaging/error';
import { ResponseError } from 'vscode-jsonrpc';

const URL = window.URL;

interface AccessControlState {
    authProviders: AuthProviderInfo[];
    oldScopes?: Map<string, Set<string>>;
    newScopes?: Map<string, Set<string>>;
    notification?: { hostToBeReviewed: string } | { updatedHost: string; updatedScopes: string[] };
    user?: User;
    disconnectDialog?: {
        authHost: string;
    };
}
interface AccessControlProps {
    service: GitpodService;
}

export class AccessControl extends React.Component<AccessControlProps, AccessControlState> {

    protected authProvidersPromise = this.props.service.server.getAuthProviders();

    constructor(props: AccessControlProps) {
        super(props);
        this.state = {
            authProviders: []
        };
    }

    componentWillMount() {
        this.onLoad();
    }

    protected async onLoad(): Promise<void> {
        try {
            const [authProviders, user] = await Promise.all([this.authProvidersPromise, this.props.service.server.getLoggedInUser()]);
            const oldScopes = await this.getOldScopes(authProviders);
            const newScopes = this.addNewScopesFromQuery(authProviders, this.clone(oldScopes));
            const notification = this.getNotificationsFromQuery(authProviders);
            this.checkAndUpdate(authProviders, oldScopes, newScopes);
            this.setState({ authProviders, oldScopes, newScopes, notification, user });
        } catch (err) {
            this.setState({});
            if (err && err instanceof ResponseError) {
                switch (err.code) {
                    case ErrorCodes.SETUP_REQUIRED:
                        window.location.href = new GitpodHostUrl(window.location.toString()).with({ pathname: "first-steps" }).toString();
                        break;
                    case ErrorCodes.USER_DELETED:
                        window.location.href = new GitpodHostUrl(window.location.toString()).asApiLogout().toString();
                        break;
                    case ErrorCodes.NOT_AUTHENTICATED:
                        this.redirectToLogin();
                        break;
                    default:
                }
            }
        }
    }
    
    protected async redirectToLogin() {
        window.location.href = new GitpodHostUrl(window.location.toString()).with({
            pathname: '/login/',
            search: `returnTo=${encodeURIComponent(window.location.toString())}`
        }).toString();
    }

    protected async getOldScopes(authProviders: AuthProviderInfo[]): Promise<Map<string, Set<string>>> {
        const result = new Map<string, Set<string>>();
        for (const authProvider of authProviders) {
            const host = authProvider.host;
            result.set(host, new Set<string>());
            const token = await this.props.service.server.getToken({ host });
            if (token) {
                result.set(host, new Set<string>(token.scopes));
            }
        }
        return result;
    }

    protected clone(map: Map<string, Set<string>>): Map<string, Set<string>> {
        const clone = new Map<string, Set<string>>();
        map.forEach((value, key) => clone.set(key, new Set<string>(value)));
        return clone;
    }

    protected getNotificationsFromQuery(authProviders: AuthProviderInfo[]) {
        const url = new URL(window.location.toString());
        const hosts = authProviders.map(p => p.host);
        const updated = url.searchParams.get('updated');
        if (updated) {
            const splitted = updated.split('@');
            if (splitted.length === 2) {
                const [updatedHost, updatedScopesString] = splitted;
                const authProvider = authProviders.find(p => p.host === updatedHost);
                if (!authProvider) {
                    return undefined;
                }
                const scopes = authProvider.scopes || [];
                const updatedScopes = updatedScopesString.split(',').filter(s => !!s && scopes.some(scope => scope === s));
                if (updatedScopes.length > 0 && hosts.some(h => h === updatedHost)) {
                    return { updatedHost, updatedScopes };
                }
            } else {
                if (!authProviders.find(p => p.host === updated)) {
                    return undefined;
                }
                return { updatedHost: updated, updatedScopes: [] };
            }
        }
        const hostToBeReviewed = url.searchParams.get('toBeReviewed');
        if (hostToBeReviewed && hosts.some(h => h === hostToBeReviewed)) {
            return { hostToBeReviewed };
        }
        return undefined;
    }

    protected addNewScopesFromQuery(authProviders: AuthProviderInfo[], scopes: Map<string, Set<string>>) {
        const url = new URL(window.location.toString());
        const hosts = authProviders.map(p => p.host);
        hosts.forEach(host => {
            const value = url.searchParams.get(host);
            if (value) {
                const authProvider = authProviders.find(p => p.host === host)!;
                let newScopes = new Set<string>(value.split(','));
                let oldScopes = new Set<string>(scopes.get(host) || []);
                const merged = new Set<string>((authProvider.scopes || []).filter(scope => oldScopes.has(scope) || newScopes.has(scope)));
                scopes.set(host, merged);
            }
        });
        return scopes;
    }

    protected checkAndUpdate(authProviders: AuthProviderInfo[], oldScopes: Map<string, Set<string>>, newScopes: Map<string, Set<string>>): void {
        const url = new URL(window.location.toString());
        if (url.searchParams.get('auto-update') !== 'true') {
            return;
        }
        const hosts = authProviders.map(p => p.host);
        const hostsInQuery = hosts.filter(h => url.searchParams.has(h));
        if (hostsInQuery.length !== 1) {
            return;
        }
        const host = hosts[0];
        const oldProviderScopes = oldScopes.get(host);
        const newProviderScopes = newScopes.get(host);
        if (oldProviderScopes && newProviderScopes && !this.equals(oldProviderScopes, newProviderScopes)) {
            log.info(`Automatically updating token: ${Array.from(newProviderScopes).join(',')}`);
            this.updateToken(host, Array.from(newProviderScopes));
        }
    }

    render() {
        return this.renderTokenOverview();
    }

    renderTokenOverview() {
        return (
            <div>
                <Toolbar style={{ padding: 0 }}>
                    <div style={{ width: '100%', justifyContent: 'space-between', marginTop: 30 }}>
                        <Typography variant="h4">Access Control</Typography>
                    </div>
                </Toolbar>
                <Toolbar style={{ display: 'flex', width: '100%', justifyContent: 'space-between' }}>
                    <div style={{ width: '100%', textAlign: 'right' }}>
                        {/* place holder */}
                    </div>
                </Toolbar>
                {this.renderTokenContainer()}
                {this.renderInfoDialog()}
                {this.renderDisconnectDialog()}
            </div>
        );
    }

    protected renderInfoDialog() {
        const notification = this.state.notification;
        if (!notification) {
            return;
        }
        let title: string;
        let message: JSX.Element;
        if ('hostToBeReviewed' in notification) {
            const { hostToBeReviewed } = notification;
            const hostLabel = this.getLabel(hostToBeReviewed);
            title = `Review required`;
            message = <DialogContentText>
                Please review the permissions for {hostLabel}. A previously called action might have failed because of a missing permission.
            </DialogContentText>;

        } else {
            const { updatedHost, updatedScopes } = notification;
            const hostLabel = this.getLabel(updatedHost);
            const scopeLabels = updatedScopes.map(s => this.getLabelForScope(s));
            title = `Permissions updated`;
            message = <DialogContentText>
                Permissions for {hostLabel} were updated{scopeLabels.length === 0 ? '.' : ' to include:'}
                <ul>
                    {scopeLabels.map((scope, index) => <li key={"scope-" + index}>{scope}</li>)}
                </ul>
            </DialogContentText>;
        }
        const shouldClose = !(this.state.notification && "hostToBeReviewed" in this.state.notification);
        const handleClose = () => {
            this.setState({
                notification: undefined
            });
            if (shouldClose) {
                window.close();
            }
        };
        return (
            <Dialog
                key="info-dialog"
                open={!!this.state.notification}
                onClose={handleClose}
            >
                <DialogTitle>{title}</DialogTitle>
                <DialogContent>{message}</DialogContent>
                <DialogActions>
                    <Button onClick={handleClose} variant="outlined" color="secondary" autoFocus>OK</Button>
                </DialogActions>
            </Dialog>
        );
    }

    protected renderTokenContainer() {
        const renderedTokens: JSX.Element[] = [];
        const { authProviders, oldScopes, newScopes } = this.state;
        if (oldScopes && newScopes) {
            for (const authProvider of authProviders) {
                const oldProviderScopes = oldScopes.get(authProvider.host);
                const newProviderScopes = newScopes.get(authProvider.host);
                if (oldProviderScopes && newProviderScopes) {
                    renderedTokens.push(<Grid item className="access-control__card-container">
                        {this.renderProviderTokens(authProvider, oldProviderScopes, newProviderScopes)}
                    </Grid>);
                }
            }
        }
        return (<Grid
            container
            alignItems="stretch"
            wrap="wrap"
            justify="space-evenly">
            {renderedTokens}
        </Grid>);
    }

    protected handleSelection(host: string, scope: string, checked: boolean): void {
        const newScopes = this.state.newScopes;
        const scopes = newScopes!.get(host)!;
        if (checked) {
            scopes.add(scope);
        } else {
            scopes.delete(scope);
        }
        this.setState({ newScopes });
    }

    protected renderScopeTooltip(scope: string) {
        const text = this.getTooltipForScope(scope);
        if (!text) {
            return undefined;
        }
        return (<Tooltip title={text} placement="right" interactive style={{ maxWidth: 200, padding: '12px' }}>
            <span>
                <InfoIcon fontSize="small" color="disabled" style={{ verticalAlign: 'middle' }} />
            </span>
        </Tooltip>);
    }

    protected getLabel(host: string) {
        switch (host) {
            case "github.com": return "GitHub";
            case "gitlab.com": return "GitLab";
            case "bitbucket.org": return "Bitbucket";
            default: return host;
        }
    }
    protected getIcon(provider: AuthProviderInfo): string | undefined {
        const { icon, authProviderType } = provider;
        if (icon) {
            return icon;
        }
        switch (authProviderType) {
            case "GitHub": return themeMode === 'light' ? "/images/github.svg" : "/images/github.dark.svg";
            case "GitLab": return themeMode === 'light' ? "/images/gitlab.svg" : "/images/gitlab.dark.svg";
            case "Bitbucket": return themeMode === 'light' ? "/images/bitbucket.svg" : "/images/bitbucket.dark.svg";
            default: return undefined;
        }
    }

    protected renderKey = 0;
    protected renderProviderTokens(provider: AuthProviderInfo, oldScopes: Set<string>, newScopes: Set<string>) {
        const { host, settingsUrl } = provider;
        const icon = this.getIcon(provider);
        const dirty = !this.equals(oldScopes, newScopes);
        const identity = this.state.user && this.state.user.identities.find(i => i.authProviderId === provider.authProviderId);
        return (<Card key={`provider-token-${this.renderKey++}`}
            style={{ 
                verticalAlign: "top", 
                textAlign: 'center', 
                padding: '20px 20px 20px 20px', 
                minHeight: '100%',
                display: 'flex',
                flexDirection: 'column'
            }}
                className="access-control__card"
            >
            <Grid item>
                <Typography variant="h5" component="h3">
                    {icon && (<img src={icon} className={'provider-icon'} />)}
                    {this.getLabel(host)}
                    {settingsUrl &&
                        <a href={settingsUrl} target="_blank" rel="noopener">
                            <IconButton style={{ padding: '10px', marginLeft: '2px' }}>
                                <OpenInNewIcon viewBox="-3 -3 30 30" fontSize="small" style={{ verticalAlign: 'middle', color: 'var(--font-color2)' }} />
                            </IconButton>
                        </a>
                    }
                </Typography>
            </Grid>

            <Grid item style={{ flexGrow: 2 }}>
                <CardContent style={{ display: 'block', float: 'left', textAlign: 'left', paddingBottom: '8px' }}>
                    {(provider.scopes || []).map((scope, index) => {
                        const disabled = provider.requirements && provider.requirements.default.includes(scope);
                        const defaultChecked = newScopes.has(scope) || (provider.requirements && provider.requirements.default.includes(scope));
                        const color = newScopes.has(scope) && !oldScopes.has(scope) ? 'secondary' : 'primary';
                        return (<p key={host + "-scope-" + index} style={{ display: 'table', marginTop: 0 }}>
                            <label style={{ display: 'flex', alignItems: 'center' }}>
                                <Checkbox
                                    onChange={(e) => this.handleSelection(host, scope, e.target.checked)}
                                    disabled={disabled}
                                    color={color}
                                    defaultChecked={defaultChecked}
                                />
                                {this.getLabelForScope(scope)}
                                {this.renderScopeTooltip(scope)}
                            </label>
                        </p>);
                    })}
                </CardContent>
            </Grid>

            {identity && (<Grid item direction="column">
                <span style={{ fontSize: "80%" }}>
                    Connected as <strong>{identity.authName}</strong>
                    <IconButton style={{ padding: '4px', marginLeft: '2px' }} onClick={() => this.setState({ disconnectDialog: { authHost: provider.host } })} title="Disconnect">
                        <HighlightOffOutlined fontSize="small" style={{ verticalAlign: 'middle', color: 'var(--font-color2)' }} />
                    </IconButton>
                </span>
            </Grid>)}

            <Grid item direction="column">
                <CardActions style={{ display: 'block', textAlign: 'center', paddingTop: 15, paddingRight: 10, paddingBottom: 12 }} disableActionSpacing={true}>
                    {!provider.isReadonly && (
                        identity ?
                            this.renderUpdateButton(dirty, () => this.updateToken(provider.host, Array.from(newScopes)), 'Update') :
                            this.renderUpdateButton(true, () => this.updateToken(provider.host,
                                // for authorization we set the required (if any) plus the new scopes
                                [...(provider.requirements && provider.requirements.default || []), ...Array.from(newScopes)]), 'Connect'))
                    }
                </CardActions>
            </Grid>
        </Card>);
    }
    protected renderUpdateButton(dirty: boolean, updateFn: () => void, label: string) {
        return (<Button disabled={!dirty} variant='outlined' color='secondary' onClick={updateFn}>
            {label}
        </Button>);
    }
    protected equals(a: Set<string>, b: Set<string>): boolean {
        return a.size === b.size && Array.from(a).every(e => b.has(e));
    }

    protected getLabelForScope(scope: string): string {
        switch (scope) {
            case "user:email": return "read email addresses";
            case "public_repo": return "write public repos";
            case "repo": return "read/write private repos";
            case "read:org": return "read organizations";
            case "workflow": return "update workflows";
            // GitLab
            case "read_user": return "read user";
            case "api": return "allow api calls";
            case "read_repository": return "repository access";
            // Bitbucket
            case "account": return "read account";
            case "repository": return "read repositories";
            case "repository:write": return "write repositories";
            case "pullrequest": return "read pull requests";
            case "pullrequest:write": return "write pull requests";
            case "webhook": return "install webhooks";
            default: return scope;
        }
    }

    protected getTooltipForScope(scope: string): string | undefined {
        switch (scope) {
            case "user:email": return "Read-only access to your email addresses";
            case "public_repo": return "Write access to code in public repositories and organizations";
            case "repo": return "Read/write access to code in private repositories and organizations";
            case "read:org": return "Read-only access to organizations (used to suggest organizations when forking a repository)";
            case "workflow": return "Allow updating GitHub Actions workflow files";
            // GitLab
            case "read_user": return "Read-only access to your email addresses";
            case "api": return "Allow making API calls (used to set up a webhook when enabling prebuilds for a repository)";
            case "read_repository": return "Read/write access to your repositories";
            // Bitbucket
            case "account": return "Read-only access to your account information";
            case "repository": return "Read-only access to your repositories (note: Bitbucket doesn't support revoking scopes)";
            case "repository:write": return "Read/write access to your repositories (note: Bitbucket doesn't support revoking scopes)";
            case "pullrequest": return "Read access to pull requests and ability to collaborate via comments, tasks, and approvals (note: Bitbucket doesn't support revoking scopes)";
            case "pullrequest:write": return "Allow creating, merging and declining pull requests (note: Bitbucket doesn't support revoking scopes)";
            case "webhook": return "Allow installing webhooks (used when enabling prebuilds for a repository, note: Bitbucket doesn't support revoking scopes)";
            default: return undefined;
        }
    }

    protected updateToken(provider: string, scopes: string[]) {
        if (scopes.length === 0) {
            return;
        }
        const thisUrl = new GitpodHostUrl(new URL(window.location.toString()));
        const returnTo = encodeURIComponent(thisUrl.with({ search: `updated=${provider}` }).toString());
        window.location.href = thisUrl.withApi({
            pathname: '/authorize',
            search: `returnTo=${returnTo}&host=${provider}&override=true&scopes=${scopes.join(',')}`
        }).toString();
    }

    protected renderDisconnectDialog() {
        const { disconnectDialog, user, authProviders } = this.state;
        const authHost = disconnectDialog?.authHost;
        const authProvider = authProviders.find(a => a.host === authHost);
        if (!disconnectDialog || !user || !authProvider) {
            return;
        }

        let message: JSX.Element;
        const handleCancel = () => {
            this.setState({
                disconnectDialog: undefined
            });
        };
        let buttonLabel: string;
        let handleButton: () => void;

        const thisUrl = new GitpodHostUrl(new URL(window.location.toString()));
        const otherIdentitiesOfUser = user.identities.filter(i => i.authProviderId !== authProvider.authProviderId);
        if (otherIdentitiesOfUser.length === 0) {
            message = (<DialogContentText>
                Disconnecting the single remaining provider would make your account unreachable. Please go the settings, if you want to delete the account.
            </DialogContentText>);

            const settingsUrl = thisUrl.asSettings().toString();

            buttonLabel = "Settings";
            handleButton = () => window.location.href = settingsUrl;
        } else {
            message = (<DialogContentText>
                You are about to disconnect {authHost}.
            </DialogContentText>);

            const returnTo = encodeURIComponent(thisUrl.with({ search: `updated=${authHost}` }).toString());
            const deauthorizeUrl = thisUrl.withApi({
                pathname: '/deauthorize',
                search: `returnTo=${returnTo}&host=${authHost}`
            }).toString();

            buttonLabel = "Proceed";
            handleButton = () => window.location.href = deauthorizeUrl;
        }

        return (
            <Dialog
                key="diconnect-dialog"
                open={!!disconnectDialog}
                onClose={handleCancel}
            >
                <DialogTitle>Disconnect {authHost}</DialogTitle>
                <DialogContent>{message}</DialogContent>
                <DialogActions>
                    <Button onClick={handleButton} variant="outlined" color="secondary" autoFocus>{buttonLabel}</Button>
                    <Button onClick={handleCancel} variant="outlined" color="primary" autoFocus>Cancel</Button>
                </DialogActions>
            </Dialog>
        );
    }
}