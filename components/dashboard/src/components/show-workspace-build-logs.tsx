/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as React from 'react';
import { WorkspaceImageBuild } from '@gitpod/gitpod-protocol';
import { WorkspaceLogView } from './workspace-log-view';

export interface ShowWorkspaceBuildLogsProps {
    buildLog?: WorkspaceBuildLog;
    showPhase: boolean;
    errorMessage?: string;
}
export interface WorkspaceBuildLog {
    info?: WorkspaceImageBuild.StateInfo;
    content?: WorkspaceImageBuild.LogContent;
}

export class ShowWorkspaceBuildLogs extends React.Component<ShowWorkspaceBuildLogsProps, {}> {

    render() {
        const buildLog = this.props.buildLog;
        if (!buildLog) {
            return ('');
        }

        let stepsText = '';
        let phaseText = '';
        let isError = false;
        if (buildLog.info) {
            const info = buildLog.info;
            phaseText = info.phase;
            if (info.currentStep && info.maxSteps) {
                stepsText = `(${info.currentStep}/${info.maxSteps})`;
            }
            isError = info.phase === 'Error';
        }

        const phaseDisplay = !this.props.showPhase || (!stepsText && !phaseText) || isError ? ('') : (
            <div className={'phase message'}>
                Phase: {phaseText} {stepsText}
            </div>
        );

        let logContent = "";
        if (buildLog.content) {
            logContent = buildLog.content.text;
        }
        return (
			<div className={'log'}>
                {phaseDisplay}
                <WorkspaceLogView content={logContent} errorMessage={this.props.errorMessage} />
            </div>
        );
    }

    protected isBaseImagePhase(props: ShowWorkspaceBuildLogsProps) {
        const buildLog = props.buildLog;
        if (!buildLog) { return false; }

        return buildLog.info && buildLog.info.phase === 'BaseImage';
    }

}