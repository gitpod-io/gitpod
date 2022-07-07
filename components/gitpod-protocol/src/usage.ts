/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { WorkspaceType } from "./protocol";

export interface BillableSession {
    // The id of the one paying the bill
    attributionId: string;

    // Relevant for workspace type. When prebuild, shows "prebuild"
    userId?: string;
    teamId?: string;

    instanceId: string;

    workspaceId: string;

    workspaceType: BillableWorkspaceType;

    // "standard" or "XL"
    workspaceClass: string;

    // When the workspace started
    startTime: number;

    // When the workspace ended
    endTime: number;

    // The credits used for this session
    credits: number;

    // TODO - maybe
    projectId?: string;
}

export type BillableWorkspaceType = Omit<WorkspaceType, "probe">;

export const billableSessionDummyData: BillableSession[] = [
    {
        attributionId: "some-attribution-id",
        userId: "prebuild",
        teamId: "prebuild",
        instanceId: "some-instance-id",
        workspaceId: "some-workspace-id",
        workspaceType: "prebuild",
        workspaceClass: "XL",
        startTime: Date.now() + -3 * 24 * 3600 * 1000, // 3 days ago
        endTime: Date.now(),
        credits: 320,
        projectId: "project-123",
    },
    {
        attributionId: "some-attribution-id2",
        userId: "some-user",
        teamId: "some-team",
        instanceId: "some-instance-id2",
        workspaceId: "some-workspace-id2",
        workspaceType: "regular",
        workspaceClass: "standard",
        startTime: Date.now() + -5 * 24 * 3600 * 1000,
        endTime: Date.now(),
        credits: 130,
        projectId: "project-123",
    },
    {
        attributionId: "some-attribution-id3",
        userId: "some-other-user",
        teamId: "some-other-team",
        instanceId: "some-instance-id3",
        workspaceId: "some-workspace-id3",
        workspaceType: "regular",
        workspaceClass: "XL",
        startTime: Date.now() + -5 * 24 * 3600 * 1000,
        endTime: Date.now() + -4 * 24 * 3600 * 1000,
        credits: 150,
        projectId: "project-134",
    },
    {
        attributionId: "some-attribution-id4",
        userId: "some-other-user2",
        teamId: "some-other-team2",
        instanceId: "some-instance-id4",
        workspaceId: "some-workspace-id4",
        workspaceType: "regular",
        workspaceClass: "standard",
        startTime: Date.now() + -10 * 24 * 3600 * 1000,
        endTime: Date.now() + -9 * 24 * 3600 * 1000,
        credits: 330,
        projectId: "project-137",
    },
    {
        attributionId: "some-attribution-id5",
        userId: "some-other-user3",
        teamId: "some-other-team3",
        instanceId: "some-instance-id5",
        workspaceId: "some-workspace-id5",
        workspaceType: "regular",
        workspaceClass: "XL",
        startTime: Date.now() + -2 * 24 * 3600 * 1000,
        endTime: Date.now(),
        credits: 222,
        projectId: "project-138",
    },
    {
        attributionId: "some-attribution-id6",
        userId: "some-other-user4",
        teamId: "some-other-team4",
        instanceId: "some-instance-id6",
        workspaceId: "some-workspace-id3",
        workspaceType: "regular",
        workspaceClass: "XL",
        startTime: Date.now() + -7 * 24 * 3600 * 1000,
        endTime: Date.now() + -6 * 24 * 3600 * 1000,
        credits: 300,
        projectId: "project-134",
    },
    {
        attributionId: "some-attribution-id8",
        userId: "some-other-user5",
        teamId: "some-other-team5",
        instanceId: "some-instance-id8",
        workspaceId: "some-workspace-id3",
        workspaceType: "regular",
        workspaceClass: "standard",
        startTime: Date.now() + -1 * 24 * 3600 * 1000,
        endTime: Date.now(),
        credits: 100,
        projectId: "project-567",
    },
    {
        attributionId: "some-attribution-id7",
        userId: "prebuild",
        teamId: "some-other-team7",
        instanceId: "some-instance-id7",
        workspaceId: "some-workspace-id7",
        workspaceType: "prebuild",
        workspaceClass: "XL",
        startTime: Date.now() + -1 * 24 * 3600 * 1000,
        endTime: Date.now(),
        credits: 200,
        projectId: "project-345",
    },
];
