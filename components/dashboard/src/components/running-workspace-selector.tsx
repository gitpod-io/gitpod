/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { ButtonWithProgress } from "./button-with-progress";
import WorkspaceEntry from "./workspace-entry";

import * as React from 'react';
import Paper from "@material-ui/core/Paper";
import Typography from "@material-ui/core/Typography";
import { Workspace, WorkspaceInfo, WorkspaceCreationResult, GitpodService } from '@gitpod/gitpod-protocol';
import { Context } from "../context";

export interface RunningWorkspaceSelectorProps {
    service: GitpodService;

    contextUrl: string;
    existingWorkspaces: WorkspaceInfo[];
    disableActions: boolean;

    requestUpdate: () => void;

    createNewWorkspace: () => Promise<WorkspaceCreationResult | undefined>;
}

export class RunningWorkspaceSelector extends React.Component<RunningWorkspaceSelectorProps, {}> {

    render() {
        const choices = this.buildChoices();
        return (
            <React.Fragment>
                <Context.Consumer>
                    {(ctx: Context) => ctx.creditAlert}
                </Context.Consumer>
                <Paper className="create-new">
                    <div>
                        <Typography variant="headline" component="h3" >
                            Create fresh workspace
                        </Typography>
                        <ButtonWithProgress onClick={this.onCreateClick.bind(this)}
                            className='button' variant='outlined' color='secondary' disabled={this.props.disableActions} data-testid="createworkspace">
                            Create
                        </ButtonWithProgress>
                    </div>
                    <Typography variant="body1">
                        There is at least one workspace for “{this.props.contextUrl}” that is running already.
                        Click on “Create” to start a new one or choose an existing workspace from the list below and click “Open” to resume.
                    </Typography>
                </Paper>
                <Typography variant="subheading" style={{
                    marginBottom: 10,
                    marginTop: 20
                }}>
                    Running workspaces for “{this.props.contextUrl}”:
                </Typography>
                {choices}
            </React.Fragment>
        );
    }

    protected async onCreateClick() {
        const workspace = await this.props.createNewWorkspace();
        if (!!workspace && workspace.workspaceURL) {
            location.href = workspace.workspaceURL;
        }
    }

    protected buildChoices() {
        const choices: JSX.Element[] = [];
        if (this.props.existingWorkspaces) {
            choices.push(... this.props.existingWorkspaces.map(ws => (
                <WorkspaceEntry
                    key={ws.workspace.id}
                    service={this.props.service}
                    workspace={ws.workspace}
                    currentInstance={ws.latestInstance}
                    handleTogglePinned={this.onTogglePinned.bind(this, ws.workspace)}
                    handleToggleShareable={this.onToggleShareable.bind(this, ws.workspace)}
                    handleWorkspaceDeleted={() => this.props.requestUpdate()}
                    disabled={this.props.disableActions}
                />
            )));
        }
        return choices;
    }

    protected async onToggleShareable(ws: Workspace) {
        await this.props.service.server.controlAdmission({
            workspaceId: ws.id,
            level: ws.shareable ? "owner" : "everyone",
        });
        await this.props.requestUpdate();
    }

    protected async onTogglePinned(ws: Workspace) {
        await this.props.service.server.updateWorkspaceUserPin({
            action: "toggle",
            workspaceId: ws.id,
        })
        await this.props.requestUpdate();
    }

}