/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Usage, WorkspaceInstanceUsageData } from "@gitpod/gitpod-protocol/lib/usage";

export const transformUsageRecord = (usage: Usage): UsageCSVRow | undefined => {
    if (usage.kind !== "workspaceinstance") {
        return;
    }

    // should be of this type for non-invoice records
    const metadata = usage.metadata as WorkspaceInstanceUsageData;

    const row: UsageCSVRow = {
        id: usage.id,
        attributionId: usage.attributionId,
        effectiveTime: `${usage.effectiveTime ?? 0}`,
        credits: `${usage.credits ?? 0}`,
        description: usage.description,
        draft: usage.draft ? "true" : "false",
        workspaceInstanceId: usage.objectId || usage.workspaceInstanceId,
        kind: usage.kind,
        userId: metadata.userId,
        endTime: metadata.endTime ?? "",
        userName: metadata.userName,
        startTime: metadata.startTime,
        contextURL: metadata.contextURL,
        workspaceId: metadata.workspaceId,
        userAvatarURL: metadata.userAvatarURL,
        workspaceType: metadata.workspaceType,
        workspaceClass: metadata.workspaceClass,
    };

    return row;
};

export type UsageCSVRow = {
    id: string;
    attributionId: string;
    effectiveTime: string;
    credits: string;
    description: string;
    draft: string;
    workspaceInstanceId: string;
    kind: string;
    userId: string;
    endTime: string;
    userName: string;
    startTime: string;
    contextURL: string;
    workspaceId: string;
    userAvatarURL: string;
    workspaceType: string;
    workspaceClass: string;
};
