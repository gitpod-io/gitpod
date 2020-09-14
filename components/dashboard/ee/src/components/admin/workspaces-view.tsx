/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import * as React from 'react';
import { GitpodService, AdminServer } from '@gitpod/gitpod-protocol';
import { DataTable, SearchSpec, ColSpec } from './datatable';
import { GitpodHostUrl } from '@gitpod/gitpod-protocol/lib/util/gitpod-host-url';
import Link from '@material-ui/core/Link';
import moment = require('moment');
import { ResponseError } from 'vscode-jsonrpc';
import { ErrorCodes } from '@gitpod/gitpod-protocol/lib/messaging/error';

export interface WorkspacesViewProps {
    service: GitpodService;
    ownerID?: string;
}

export const WorkspacesView: React.SFC<WorkspacesViewProps> = props => {
    const update = async (q: SearchSpec<AdminServer.WorkspaceAndInstance>) => {
        try {
            return props.service.server.adminGetWorkspaces({
                limit: q.rowsPerPage,
                offset: q.rowsPerPage * q.page,
                orderBy: q.orderCol,
                orderDir: q.orderDir,
                ownerId: props.ownerID,
                searchTerm: q.searchTerm
            });
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
    const columns: ColSpec<AdminServer.WorkspaceAndInstance>[] = [
        {
            header: "ID",
            property: "workspaceId",
            sortable: true,
            render: u => <Link href={`/admin/#/workspace/${u.workspaceId}`}>{u.workspaceId}</Link>
        },
        {
            header: "Context URL",
            property: "contextURL",
            sortable: true
        },
        {
            header: "Last Started",
            property: "instanceCreationTime",
            sortable: true,
            render: u => <div>{moment(u.instanceCreationTime).fromNow()}</div>
        },
        {
            header: "Phase",
            property: "phase",
            sortable: true
        }
    ]
    if (!props.ownerID) {
        columns.splice(1, 0, {
            header: "Owner",
            property: "ownerId",
            sortable: true,
            render: u => <Link href={`/admin/#/user/${u.ownerId}`}>{u.ownerId}</Link>
        })
    }

    return <DataTable<AdminServer.WorkspaceAndInstance> 
        columns={columns} 
        defaultOrderCol="instanceCreationTime" 
        defaultOrderDir="desc"
        update={update} 
        searchable={true}/>
}