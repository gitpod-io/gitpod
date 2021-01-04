/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as React from 'react';
import Button from "@material-ui/core/Button";
import { GitpodService, RunningWorkspacePrebuildStarting, DisposableCollection } from "@gitpod/gitpod-protocol";
import { CubeFrame } from "./cube-frame";
import { WorkspaceLogView } from "./workspace-log-view";
import { WithBranding } from './with-branding';
import { Context } from '../context';

export interface RunningPrebuildViewProps {
    service: GitpodService;
    prebuildingWorkspaceId: string;
    justStarting: RunningWorkspacePrebuildStarting;

    onIgnorePrebuild: () => void;
    onWatchPrebuild: () => void;
}

interface RunningPrebuildViewState {
    updateLoglineToggle?: boolean;
    errorMessage?: string;
}

export class RunningPrebuildView extends React.Component<RunningPrebuildViewProps, RunningPrebuildViewState> {
    protected logline: string | undefined;

    constructor(props: RunningPrebuildViewProps) {
        super(props);

        this.state = {};
        this.logline = `Workspace prebuild is ${this.props.justStarting} ...\r\n`;

        this.props.service.registerClient({
            onHeadlessWorkspaceLogs: evt => {
                if (evt.workspaceID !== this.props.prebuildingWorkspaceId) {
                    return;
                }

                // TODO(ak) there is no contract that setState should immediately trigger render
                // it maybe buffer state and then call render, so some log lines can be lost
                // we should rather get a reference to xterm in this component and write here directly
                this.logline = evt.text;
                this.setState({ updateLoglineToggle: !this.state.updateLoglineToggle });
            }
        });
    }

    private readonly toDispose = new DisposableCollection();
    componentWillMount() {
        this.watch();
        this.toDispose.push(this.props.service.registerClient({
            notifyDidOpenConnection: () => this.watch()
        }));
    }
    componentWillUnmount() {
        this.toDispose.dispose();
    }

    private watch(): void {
        this.props.service.server.watchHeadlessWorkspaceLogs(this.props.prebuildingWorkspaceId);
        this.props.onWatchPrebuild();
    }

    public render() {
        const logline = this.logline;
        this.logline = undefined;
        return (
            <WithBranding service={this.props.service}>
                <Context.Consumer>
                    {(ctx) =>
                        <CubeFrame
                            errorMessage={this.state.errorMessage}
                            errorMode={!!this.state.errorMessage}
                            branding={ctx.branding}>
                            <div className="message action">
                                <Button className='button' variant='outlined' color='secondary' onClick={this.props.onIgnorePrebuild}>Skip Prebuild</Button>
                            </div>
                            <WorkspaceLogView content={logline} />
                        </CubeFrame>
                    }
                </Context.Consumer>
            </WithBranding>
        );
    }

}