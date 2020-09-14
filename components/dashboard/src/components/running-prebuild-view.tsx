/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as React from 'react';
import Button from "@material-ui/core/Button";
import { GitpodService, RunningWorkspacePrebuildStarting } from "@gitpod/gitpod-protocol";
import { CubeFrame } from "./cube-frame";
import { WorkspaceLogView } from "./workspace-log-view";
import { HeadlessWorkspaceEventType } from '@gitpod/gitpod-protocol/lib/headless-workspace-log';
import { WithBranding } from './with-branding';
import { Context } from '../context';

export interface RunningPrebuildViewProps {
    service: GitpodService;
    prebuildingWorkspaceId: string;
    justStarting: RunningWorkspacePrebuildStarting;

    onIgnorePrebuild: () => void;
    onBuildDone: (didFinish: boolean) => void;
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

        let buildIsDone = false;
        this.props.service.registerClient({
            onHeadlessWorkspaceLogs: evt => {
                if (evt.workspaceID !== this.props.prebuildingWorkspaceId) {
                    return;
                }

                this.logline = evt.text;
                this.setState({ updateLoglineToggle: !this.state.updateLoglineToggle });

                if (!buildIsDone && !HeadlessWorkspaceEventType.isRunning(evt.type)) {
                    buildIsDone = true;
                    this.props.onBuildDone(HeadlessWorkspaceEventType.didFinish(evt.type));
                }
            },
            onInstanceUpdate: () => {},
            onWorkspaceImageBuildLogs: () => {}
        });
    }

    componentWillMount() {
        this.props.service.server.watchHeadlessWorkspaceLogs({workspaceId: this.props.prebuildingWorkspaceId});
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