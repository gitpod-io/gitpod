/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as React from 'react';
import "reflect-metadata";
import Button from '@material-ui/core/Button';
import { GitpodHostUrl } from "@gitpod/gitpod-protocol/lib/util/gitpod-host-url";
import { User, AuthProviderInfo } from "@gitpod/gitpod-protocol";

const URL = window.URL;

interface LoginProps {
    user: Promise<User>;
    authProviders: Promise<AuthProviderInfo[]>;
}

interface LoginState {
    user?: User;
    authProviders: AuthProviderInfo[];
}

export class Login extends React.Component<LoginProps, LoginState> {

    constructor(props: LoginProps) {
        super(props);
        this.state = {
            authProviders: []
        };
    }

    componentWillMount() {
        this.onLoad();
    }

    protected async onLoad(): Promise<void> {
        this.updateAuthProviders();
        this.checkUser();
    }

    protected async updateAuthProviders(): Promise<void> {
        try {
            const authProviders = await this.props.authProviders;
            if (authProviders.length === 1) {
                // if login is required and only one auth provider exists,
                // just proceed with the login
                (async () => {
                    try {
                        await this.props.user;
                    } catch {
                        this.loginWithHost(authProviders[0].host);
                    }
                })();
            }
            this.setState({ authProviders });
        } catch (error) {
            console.log(error);
        }
    }

    protected async checkUser(): Promise<void> {
        try {
            await this.props.user;

            // redirect to a valid `returnTo` or `/workspaces` asap
            window.location.href = this.getReturnToURL();
        } catch {
            // expected error if not logged in
        }
    }

    protected getReturnToURL(): string {
        const url = new URL(window.location.toString());
        let returnTo = url.searchParams.get("returnTo");
        if (!returnTo || !returnTo.startsWith(`${url.protocol}//${url.host}`)) {
            returnTo = new GitpodHostUrl(window.location.toString()).asDashboard().toString();
        }
        return returnTo;
    }

    render() {
		return (
            <div className={'login-container'}>
                <div className={'login-header'}>
                    <h1>Login with</h1>
                </div>
                {this.renderLoginButtons()}
            </div>
        );
    }

    protected renderLoginButtons() {
        const buttons = this.state.authProviders.map(p => {
            const icon = this.getIcon(p);
            return (<Button key={"btn-" + p.host} variant="contained" style={{ textTransform: 'none' }} size="large" onClick={() => this.loginWithHost(p.host)}>
                {icon && (<img src={icon} className={'provider-icon'} />)}
                {this.getLabel(p.host)}
            </Button>);
        });

        return (<div className={'login-buttons-container'}>
            {buttons}
        </div>);
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
            case "GitHub": return "/images/github.svg";
            case "GitLab": return "/images/gitlab.svg";
            case "Bitbucket": return "/images/bitbucket.svg";
            default: return undefined;
        }
    }

    protected loginWithHost(host: string) {
        const returnTo = this.getReturnToURL();
        const returnToPart = returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : '';
        const search = `host=${host}${returnToPart}`;
        window.location.href = new GitpodHostUrl(window.location.toString()).withApi({
            pathname: '/login/',
            search
        }).toString();
    }

}