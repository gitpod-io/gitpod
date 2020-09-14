/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import "reflect-metadata";
import * as React from 'react';

import { MainMenu, MenuEntry } from './menu';
import { GitpodService, User, AuthProviderInfo } from '@gitpod/gitpod-protocol';
import { GitpodHostUrl } from "@gitpod/gitpod-protocol/lib/util/gitpod-host-url";
import { Footer } from "./footer";
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { WithBranding } from "./with-branding";
import { Context } from "../context";
import { EELicenseCatch } from "./ee-license-catch";

export interface ApplicationProps {
    service?: GitpodService;
    userPromise?: Promise<User>;
    linksOverride?: JSX.Element;
}

interface ApplicationState {
    user?: User;
    authProviders?: AuthProviderInfo[];
    userLoaded: boolean;
}

export class ApplicationFrame extends React.Component<ApplicationProps, ApplicationState> {

    constructor(props: { service?: GitpodService }) {
        super(props);
        this.state = {
            userLoaded: false,
        };
    }

    componentWillMount() {
        this.load();
        this.refreshLogin();
    }

    protected async load(): Promise<void> {
        if (!this.props.service) {
            return;
        }
        const server = this.props.service.server;
        const userPromise = this.props.userPromise || server.getLoggedInUser({});
        const [user, authProviders] = await Promise.all([
            userPromise.catch(log.error),
            server.getAuthProviders({}).catch(log.error),
        ]);
        this.setState({
            user: user || undefined,
            userLoaded: true,
            authProviders: authProviders || []
        });
    }

    protected refreshLogin() {
        // We want to get a fresh session cookie as side effect. No need to wait or handle the response
        const uri = new GitpodHostUrl(window.location.toString())
            .withApi(url => ({ pathname: '/refresh-login' }))
            .toString();
        fetch(uri, { credentials: 'include' });
    }

    render() {
        return (
            <EELicenseCatch>
                <div className="page-container">
                    <WithBranding service={this.props.service}>
                        <Context.Consumer>
                            {(ctx) => {
                                let menuEntries = MenuEntry.ALL;
                                if (ctx && ctx.menuEntries) {
                                    menuEntries = ctx.menuEntries(menuEntries);
                                }
                                return (
                                    <MainMenu
                                        branding={ctx.branding}
                                        menuEntries={menuEntries}
                                        user={this.state.user}
                                        authProviders={this.state.authProviders || []}
                                        userLoaded={this.state.userLoaded}
                                        linksOverride={this.props.linksOverride} />
                                    );
                            }}
                        </Context.Consumer>
                        <div id="main">
                            <div className='content content-area'>
                                {this.props.children}
                            </div>
                        </div>
                        <Footer />
                    </WithBranding>
                </div>
            </EELicenseCatch>
        );
    }
}