/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import {
    ListWorkspaceSessionsRequest,
    PrebuildInitializer,
    WorkspaceSession,
    WorkspaceSpec_WorkspaceType,
} from "@gitpod/public-api/lib/gitpod/v1/workspace_pb";
import { organizationClient, workspaceClient } from "../../service/public-api";
import dayjs from "dayjs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { noPersistence } from "../../data/setup";
import { Timestamp } from "@bufbuild/protobuf";
import type { OrganizationMember } from "@gitpod/public-api/lib/gitpod/v1/organization_pb";

const pageSize = 100;
const maxPages = 100; // safety limit if something goes wrong with pagination

type GetAllWorkspaceSessionsArgs = Pick<ListWorkspaceSessionsRequest, "to" | "from" | "organizationId"> & {
    signal?: AbortSignal;
    onProgress?: (percentage: number) => void;
};
export const getAllWorkspaceSessions = async ({
    from,
    to,
    signal,
    organizationId,
    onProgress,
}: GetAllWorkspaceSessionsArgs): Promise<WorkspaceSession[]> => {
    const records: WorkspaceSession[] = [];
    let page = 0;
    while (!signal?.aborted && page < maxPages) {
        const response = await workspaceClient.listWorkspaceSessions(
            {
                organizationId,
                from,
                to,
                pagination: {
                    page,
                    pageSize,
                },
            },
            {
                signal,
            },
        );
        if (response.workspaceSessions.length === 0) {
            break;
        }

        records.push(...response.workspaceSessions);
        onProgress && onProgress(page);

        page = page + 1;
    }

    return records;
};

type Args = Pick<ListWorkspaceSessionsRequest, "organizationId" | "from" | "to"> & {
    organizationName: string;
    signal?: AbortSignal;
    onProgress?: (percentage: number) => void;
};

export type DownloadUsageCSVResponse = {
    blob: Blob | null;
    filename: string;
    count: number;
};

const downloadUsageCSV = async ({
    organizationId,
    from,
    to,
    organizationName,
    signal,
    onProgress,
}: Args): Promise<DownloadUsageCSVResponse> => {
    const start = dayjs(from?.toDate()).format("YYYYMMDD");
    const end = dayjs(to?.toDate()).format("YYYYMMDD");
    const filename = `gitpod-usage-${organizationName}-${start}-${end}.csv`;

    const records = await getAllWorkspaceSessions({
        organizationId,
        from,
        to,
        signal,
        onProgress,
    });

    if (records.length === 0) {
        return {
            blob: null,
            filename,
            count: 0,
        };
    }

    const orgMembers = await organizationClient.listOrganizationMembers({
        organizationId,
    });

    const rows = records
        .map((record) => {
            const member = orgMembers.members.find((m) => m.userId === record.workspace?.metadata?.ownerId);
            if (!member) {
                return null;
            }
            return transformSessionRecord(record, member);
        })
        .filter((r) => !!r);
    const fields = Object.keys(rows[0]) as (keyof ReturnType<typeof transformSessionRecord>)[];

    // TODO: look into a lib to handle this more robustly
    // CSV Rows
    const csvRows = rows.map((row) => {
        const rowString = fields
            .map((fieldName) => {
                const value = row[fieldName];
                if (typeof value === "bigint") {
                    return value.toString();
                }

                return JSON.stringify(row[fieldName]);
            })
            .join(",");

        return rowString;
    });

    // Prepend Header
    csvRows.unshift(fields.join(","));

    console.log(csvRows);

    const blob = new Blob([`\ufeff${csvRows.join("\n")}`], {
        type: "text/csv;charset=utf-8",
    });

    return {
        blob,
        filename,
        count: rows.length,
    };
};

const displayWorkspaceType = (type?: WorkspaceSpec_WorkspaceType) => {
    if (!type) {
        return "" as const;
    }

    switch (type) {
        case WorkspaceSpec_WorkspaceType.REGULAR:
            return "Regular" as const;
        case WorkspaceSpec_WorkspaceType.PREBUILD:
            return "Prebuild" as const;
        default:
            throw new Error(`Unknown workspace type: ${type}`);
    }
};

const displayTime = (timestamp?: Timestamp) => {
    if (!timestamp) {
        return "";
    }

    return timestamp.toDate().toISOString();
};

export const transformSessionRecord = (session: WorkspaceSession, member: OrganizationMember) => {
    const initializerType = session.workspace?.spec?.initializer?.specs;
    const prebuildInitializer = initializerType?.find((i) => i.spec.case === "prebuild")?.spec.value as
        | PrebuildInitializer
        | undefined;

    const url = new URL(session.workspace?.metadata?.originalContextUrl ?? "");
    const [lastSegment = "", ...rest] = url.pathname.slice(1).split("/").reverse();
    const firstSegment = rest.reverse().join("/");

    const row = {
        id: session.id,

        creationTime: displayTime(session.creationTime),
        deployedTime: displayTime(session.deployedTime),
        startedTime: displayTime(session.startedTime),
        stoppingTime: displayTime(session.stoppingTime),
        stoppedTime: displayTime(session.stoppedTime),

        // draft: session.draft ? "true" : "false", // should we indicate here somehow that the ws is still running?
        workspaceID: session?.workspace?.id,
        configurationID: session.workspace?.metadata?.configurationId,
        prebuildID: prebuildInitializer?.prebuildId,
        userID: member.userId,
        userName: member.fullName,
        // userAvatarURL: metadata.userAvatarURL, // maybe?, probably not

        contextURL: session.workspace?.metadata?.originalContextUrl,
        contextURLSegment_1: firstSegment,
        contextURLSegment_2: lastSegment,

        workspaceType: displayWorkspaceType(session.workspace?.spec?.type),
        workspaceClass: session.workspace?.spec?.class,

        workspaceImageSize: session.metrics?.workspaceImageSize,
        workspaceImageTotalSize: session.metrics?.totalImageSize,
        ide: session.workspace?.spec?.editor?.name, // maybe?
    };

    console.log(row);

    return row;
};

export const useDownloadSessionsCSV = (args: Args) => {
    const client = useQueryClient();
    const key = getDownloadUsageCSVQueryKey(args);

    const abort = useCallback(() => {
        client.removeQueries([key]);
    }, [client, key]);

    const query = useQuery<DownloadUsageCSVResponse, Error>(
        key,
        async ({ signal }) => {
            const resp = await downloadUsageCSV({ ...args, signal });

            // Introduce a slight artificial delay when completed to allow progress to finish the transition to 100%
            // While this feels a bit odd here instead of in the component, it's much easier to add
            // the delay here than track it in react state
            // 1000ms because the transition duration is 1000ms
            await new Promise((r) => setTimeout(r, 1000));

            return resp;
        },
        {
            retry: false,
            cacheTime: 0,
            staleTime: 0,
        },
    );

    return {
        ...query,
        abort,
    };
};

const getDownloadUsageCSVQueryKey = (args: Args) => {
    return noPersistence(["usage-export", args]);
};
