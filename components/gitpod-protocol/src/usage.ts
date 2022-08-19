/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { User, WorkspaceType } from "./protocol";

export interface BillableSession {
    // The id of the one paying the bill
    attributionId: string;

    // Relevant for workspace type. When prebuild, shows "prebuild"
    userId?: string;
    teamId?: string;

    instanceId: string;

    workspaceId: string;

    workspaceType: BillableWorkspaceType;

    workspaceClass: string;

    // When the workspace started
    startTime: string;

    // When the workspace ended. Not set when the workspace is still running.
    endTime?: string;

    // The credits used for this session
    credits: number;

    // TODO - maybe
    projectId?: string;
}

export interface ExtendedBillableSession extends BillableSession {
    contextURL?: string;
    user?: Pick<User.Profile, "name" | "avatarURL">;
}

export interface BillableSessionRequest {
    attributionId: string;
    startedTimeOrder: SortOrder;
    from?: number;
    to?: number;
}

export type BillableWorkspaceType = WorkspaceType;

export enum SortOrder {
    Descending = 0,
    Ascending = 1,
}
