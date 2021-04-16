/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import React = require("react");
import { CommandService, Disposable, DisposableCollection } from "@theia/core";
import { GitState } from "../git-state";
import { GitHosterCommand } from "../githoster-frontend-contribution";
import { GitHosterModel } from "../model/githoster-model";

export class WritePermissionsView extends React.Component<WritePermissionsView.Props, WritePermissionsView.State> {

    readonly state: WritePermissionsView.State = {
        hasWritePermission: true,
        isRemoteSet: true,
    }

    protected readonly toDispose = new DisposableCollection();
    componentWillMount(): void {
        const intervalId = window.setInterval(() => this.checkRemoteWritePermissions(), 2000);
        this.toDispose.push(Disposable.create(() => window.clearInterval(intervalId)));
    }
    componentWillUnmount(): void {
        this.toDispose.dispose();
    }

    protected async getRepositoryFromRemote(remote: string = "origin") {
        const remoteUrl = await this.props.gitState.getRemoteUrl(remote);
        if (remoteUrl) {
            return this.props.gitState.parseRemoteUrl(remoteUrl);
        }
    }

    protected async checkRemoteWritePermissions() {
        try {
            const repository = await this.getRepositoryFromRemote();
            if (repository) {
                const { name, owner } = repository;
                if (this.state.repository && this.state.repository.name == name && this.state.repository.owner == owner) {
                    return;
                }
                const hasWritePermission = await this.props.gitHoster.hasWritePermission(owner, name);
                if (!hasWritePermission) {
                    // FIXME prefetch forks, but which?
                }
                this.setState(prev => {
                    return {
                        hasWritePermission,
                        repository,
                        isRemoteSet: true
                    }
                });
            } else {
                this.setState(prev => {
                    return {
                        hasWritePermission: false,
                        isRemoteSet: false
                    }
                });
            }
        } catch (error) {
            if (error) {
                console.debug(error);
            }
            this.setState(prev => {
                return {
                    hasWritePermission: false,
                    isRemoteSet: false
                }
            });
        }
        this.forceUpdate();
    }

    render(): JSX.Element | null {
        const { repository, isRemoteSet, hasWritePermission } = this.state;
        if (!isRemoteSet) {
            return null; // todo: check preconditions
        }
        if (!hasWritePermission && repository) {
            return <div className="write-permissions-view">
                {this.renderMessage(`You don't have push permissions for "${repository.owner}/${repository.name}"`)}
                {this.renderFork()}
            </div>
        }
        return null;
    }

    protected renderMessage(message: string): JSX.Element {
        return <div className="write-permissions-warn">
            <i className="fa fa-lg fa-exclamation-triangle write-permissions-icon" />
            <span>{message}</span>
        </div>
    }

    protected renderFork(): JSX.Element {
        return <button className="write-permissions-action theia-button" onClick={this.fork}>Fork...</button>;
    }
    protected readonly fork = () => {
        this.props.commandService.executeCommand(GitHosterCommand.fork.id);
    };

}
export namespace WritePermissionsView {
    export interface Props {
        commandService: CommandService,
        gitHoster: GitHosterModel,
        gitState: GitState,
    }
    export interface State {
        hasWritePermission: boolean,
        isRemoteSet: boolean,
        repository?: { name: string, owner: string }
    }
}