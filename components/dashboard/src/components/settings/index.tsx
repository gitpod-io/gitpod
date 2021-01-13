/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as React from 'react';
import "reflect-metadata";
import debounce = require('lodash.debounce');
import { CancellationTokenSource, CancellationToken } from 'vscode-jsonrpc/lib/cancellation';
import { UserEnvVars } from '../user-env-vars';
import { ApplicationFrame } from '../page-frame';
import { ErrorCodes } from '@gitpod/gitpod-protocol/lib/messaging/error';
import { GitpodHostUrl } from '@gitpod/gitpod-protocol/lib/util/gitpod-host-url';
import { ResponseError } from 'vscode-jsonrpc';

import { UserSettings } from '../user-settings';
import { DeleteAccountView } from '../delete-account-view';
import Paper from '@material-ui/core/Paper';
import { ApiTokenView } from '../api-tokens';
import { AuthProviders } from '../auth-providers';
import { User, GitpodService } from '@gitpod/gitpod-protocol';
import { FeatureSettings } from '../feature-settings';

interface SettingsProps {
    service: GitpodService;
    user: Promise<User>;
}

interface SettingsState {
    user?: User;
    hasIDESettingsPermission?: boolean;
}

export class Settings extends React.Component<SettingsProps, SettingsState> {

    constructor(props: SettingsProps) {
        super(props);

        this.state = {};
        (async () => {
            try {
                const [user, hasIDESettingsPermission] = await Promise.all([
                    this.props.user,
                    this.props.service.server.hasPermission('ide-settings')
                ]);
                this.setState({ user, hasIDESettingsPermission });
            } catch (e) {
                if (e instanceof ResponseError) {
                    switch (e.code) {
                        case ErrorCodes.SETUP_REQUIRED:
                            window.location.href = new GitpodHostUrl(window.location.toString()).with({ pathname: "first-steps" }).toString();
                            break;
                        case ErrorCodes.NOT_AUTHENTICATED:
                            window.location.href = new GitpodHostUrl(window.location.toString()).withApi({
                                pathname: '/login/',
                                search: 'returnTo=' + encodeURIComponent(window.location.toString())
                            }).toString();
                            break;
                        case ErrorCodes.USER_DELETED:
                            window.location.href = new GitpodHostUrl(window.location.toString()).asApiLogout().toString();
                            break;
                        default:
                    }
                }
                throw e;
            }
        })();
    }

    render() {
        return (
            <ApplicationFrame service={this.props.service}>
                <Paper style={{ padding: 20 }}>
                    <h3>Email Settings</h3>
                    <UserSettings service={this.props.service} user={this.state.user} onChange={this.onChange} />

                    <h3 style={{ marginTop: 50 }}>Environment Variables</h3>
                    <UserEnvVars service={this.props.service} user={this.state.user} />
                    <ApiTokenView service={this.props.service} />

                    <h3 style={{ marginTop: 50 }}>Git Provider Integrations</h3>
                    <AuthProviders service={this.props.service} user={this.state.user} mode="user-settings" />

                    <h3 style={{ marginTop: 50 }}>Feature Preview</h3>
                    {this.state.user && <FeatureSettings service={this.props.service} user={this.state.user} onChange={this.onChange} />}

                    {this.state.user && <DeleteAccountView service={this.props.service} user={this.state.user} />}
                </Paper>
            </ApplicationFrame>
        );
    }

    private onChange = (update: Partial<User>) => {
        const user = Object.assign(this.state.user!, update);
        this.setState({ user });

        if (this.commitTokenSource) {
            this.commitTokenSource.cancel();
        }
        this.commitTokenSource = new CancellationTokenSource();
        const token = this.commitTokenSource.token;
        this.commit(update, token);
    }

    private commitTokenSource: CancellationTokenSource | undefined;
    private commit = debounce(async (update: Partial<User>, token: CancellationToken) => {
        try {
            if (token.isCancellationRequested) {
                return;
            }
            const user = await this.props.service.server.updateLoggedInUser(update);
            if (token.isCancellationRequested) {
                return;
            }
            this.setState({ user });
        } catch (e) {
            console.error('Failed to commit settings:', e);
        }
    }, 150);

}