/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import * as React from 'react';
import { GitpodService, WorkspaceAndInstance } from '@gitpod/gitpod-protocol';
import Typography from '@material-ui/core/Typography';
import Table from '@material-ui/core/Table';
import TableRow from '@material-ui/core/TableRow';
import TableCell from '@material-ui/core/TableCell';
import Button from '@material-ui/core/Button';
import Grid from '@material-ui/core/Grid';
import { GitpodHostUrl } from '@gitpod/gitpod-protocol/lib/util/gitpod-host-url';
import Link from '@material-ui/core/Link';
import { ResponseError } from 'vscode-jsonrpc';
import { ErrorCodes } from '@gitpod/gitpod-protocol/lib/messaging/error';

export interface WorkspaceViewProps {
    service: GitpodService;
    workspaceID: string;

    renderAdditionalWorkspaceProperties?: AdditionalWorkspacePropertiesRenderer;
}
export type AdditionalWorkspacePropertiesRenderer = (service: GitpodService, workspace: WorkspaceAndInstance | undefined) => JSX.Element;

interface WorkspaceViewState {
    workspace?: WorkspaceAndInstance;
}

interface DetailRowSpec {
    name: string;
    actions?: (u: WorkspaceAndInstance) => JSX.Element;
    render?: (u: WorkspaceAndInstance) => any;
}

export class WorkspaceView extends React.Component<WorkspaceViewProps, WorkspaceViewState> {

    constructor(props: WorkspaceViewProps) {
        super(props);
        this.state = {};
    }

    async componentDidMount() {
        try {
            const workspace = await this.props.service.server.adminGetWorkspace(this.props.workspaceID);
            this.setState({workspace});
        } catch (err) {
            var rerr: ResponseError<any> = err;
            if (rerr.code === ErrorCodes.PERMISSION_DENIED) {
                window.location.href = new GitpodHostUrl(window.location.toString()).asDashboard().toString();
            }

            // TODO: improve error handling
            console.log(err);
            throw err;
        }
    }

    render() {
        const workspace = this.state.workspace;
        const fields: { [P in keyof Partial<WorkspaceAndInstance>]: DetailRowSpec } = {
            workspaceId: { 
                name: "ID" 
            },
            workspaceCreationTime: { 
                name: "Creation Date" 
            },
            ownerId: { 
                name: "Owner",
                render: u => <Link href={`/admin/#/user/${u.ownerId}`}>{u.ownerId}</Link>
            },
            contextURL: { 
                name: "Context URL",
                render: u => <a href={u.contextURL}>{u.contextURL}</a>
            },
            phase: {
                name: "Phase",
            },
            instanceCreationTime: {
                name: "Last Started"
            },
            instanceId: {
                name: "Latest Instance ID"
            },
            shareable: {
                name: "Shareable",
                render: u => !!u.shareable ? "shareable" : "not shareable"
            },
            workspaceImage: {
                name: "Workspace Image",
                render: u => <pre>{JSON.stringify(u.config.image, null, 2)}</pre>
            },
            softDeleted: {
                name: "Deleted"
            }
        };

        return <React.Fragment>
            <Grid container>
                <Grid item xs={8}><Typography variant="h2">Workspace: {this.props.workspaceID}</Typography></Grid>
                <Grid item xs={4} style={{textAlign: "right"}}>
                    <Button href={`/api/enforcement/kill-workspace/${this.props.workspaceID}`} variant="contained">Stop Immediately</Button>
                    <Button disabled={!this.state || !this.state.workspace || this.state.workspace.phase != "stopped"} href={`/workspace-download/get/${this.props.workspaceID}`} variant="contained">Download</Button>
                </Grid>
            </Grid>
            { !workspace && <div className="loading-skeleton dummy" style={{ minWidth: "20em", minHeight: "10em" }} /> }
            { workspace &&
                <Table>
                    { Object.getOwnPropertyNames(fields).map((f, i) => <TableRow key={i}>
                        <TableCell><strong>{fields[f].name}</strong></TableCell>
                        <TableCell>{!!fields[f].render ? fields[f].render(workspace) : workspace[f]}</TableCell>
                        <TableCell style={{textAlign: "right"}}>{fields[f].actions && fields[f].actions(workspace)}</TableCell>
                    </TableRow>) }
                    {
                      this.props.renderAdditionalWorkspaceProperties && this.props.renderAdditionalWorkspaceProperties(this.props.service, workspace)
                    }
                </Table>
            }
        </React.Fragment>
    }

}