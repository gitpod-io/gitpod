/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */


import * as React from 'react';
import { GitpodHostUrl } from '@gitpod/gitpod-protocol/lib/util/gitpod-host-url';
import { GitpodService, AuthProviderInfo } from '@gitpod/gitpod-protocol';

export namespace ShowNotFoundError {
    export interface Props {
        data: any;
        service: GitpodService;
    }
    export interface State {
        authProviders?: AuthProviderInfo[];
    }
}

export default class ShowNotFoundError extends React.Component<ShowNotFoundError.Props, ShowNotFoundError.State> {

    constructor(props: ShowNotFoundError.Props) {
        super(props);
        this.state = {};
    }

    componentWillMount() {
        this.onLoad();
    }

    protected async onLoad(): Promise<void> {
        try {
            const authProviders = await this.props.service.server.getAuthProviders({});
            this.setState({ authProviders });
        } catch (err) {
            this.setState({});
        }
    }

    // tslint:disable:max-line-length
    render() {
        const { owner, repoName } = this.props.data;
        return (
            <div className="sorry">
                <h1 className="heading">{owner}/{repoName} could not be found!</h1>
                {this.renderMessage()}
            </div>
        );
    }

    protected renderMessage() {
        const { host, owner, userIsOwner, userScopes, lastUpdate } = this.props.data;

        const authProviders = this.state.authProviders;
        let message: JSX.Element | undefined;
        if (authProviders) {
            const provider = authProviders.find(p => p.host === host);
            if (!provider) {
                return undefined;
            }
            const missingScope = this.guessMissingScope(provider, userScopes);
            const link = new GitpodHostUrl(window.location.toString()).withApi({
                pathname: '/authorize',
                search: `returnTo=${encodeURIComponent(window.location.toString())}&host=${host}&scopes=${missingScope}`
            }).toString();

            let updatedRecently = false;
            if (lastUpdate && typeof lastUpdate === 'string') {
                try {
                    const hours = (new Date().getTime() - Date.parse(lastUpdate)) / 1000 / 60 / 60;
                    updatedRecently = hours < 1;
                } catch {
                    // ignore
                }
            }
            const privatePermission = this.privatePermissionGranted(userScopes, missingScope);
            if (!privatePermission) {
                message = (
                    <div className="text">The repository might be private. <a href={link}>Grant access to private repositories</a>.</div>
                );
            } else if (userIsOwner) {
                message = (
                    <div className="text">The repository is not found in your account.</div>
                );
            } else {
                if (!updatedRecently) {
                    message = (
                        <div className="text">Permission to access private repositories has been granted. If you are a member of '{owner}', try to <a href={link}>request access</a> for Gitpod.</div>
                    );
                } else {
                    message = (
                        <div className="text">Your access token was updated recently. <a href={link}>Try again</a> if the repository exists and Gitpod was approved for '{owner}'.</div>
                    );
                }
            }
        }
        return message;
    }

    protected guessMissingScope(authProvider: AuthProviderInfo, userScopes: string[]) {
        // TODO: this should be aware of already granted permissions
        return authProvider.host === "github.com" ? "repo" : "read_repository";
    }
    protected privatePermissionGranted(userScopes: string[], missingScope: string): boolean {
        return userScopes.indexOf(missingScope) > -1;
    }

}