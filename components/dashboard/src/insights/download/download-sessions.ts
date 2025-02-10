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
import { workspaceClient } from "../../service/public-api";
import dayjs from "dayjs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { noPersistence } from "../../data/setup";
import { Timestamp } from "@bufbuild/protobuf";

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

export type DownloadInsightsCSVResponse = {
    blob: Blob | null;
    filename: string;
    count: number;
};

const downloadInsightsCSV = async ({
    organizationId,
    from,
    to,
    organizationName,
    signal,
    onProgress,
}: Args): Promise<DownloadInsightsCSVResponse> => {
    const start = dayjs(from?.toDate()).format("YYYYMMDD");
    const end = dayjs(to?.toDate()).format("YYYYMMDD");
    const filename = `gitpod-sessions-${organizationName}-${start}-${end}.csv`;

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

    const rows = records.map(transformSessionRecord).filter((r) => !!r);
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

    const blob = new Blob([`\ufeff${csvRows.join("\n")}`], {
        type: "text/csv;charset=utf-8",
    });

    return {
        blob,
        filename,
        count: rows.length,
    };
};

export const displayWorkspaceType = (type?: WorkspaceSpec_WorkspaceType) => {
    switch (type) {
        case WorkspaceSpec_WorkspaceType.PREBUILD:
            return "prebuild" as const;
        case WorkspaceSpec_WorkspaceType.REGULAR:
            return "workspace" as const;
        default:
            return "unknown" as const;
    }
};

const displayTime = (timestamp?: Timestamp) => {
    if (!timestamp) {
        return "";
    }

    return timestamp.toDate().toISOString();
};

export const transformSessionRecord = (session: WorkspaceSession) => {
    const initializerType = session.workspace?.spec?.initializer?.specs;
    const prebuildInitializer = initializerType?.find((i) => i.spec.case === "prebuild")?.spec.value as
        | PrebuildInitializer
        | undefined;

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
        userID: session.owner?.id,
        userName: session.owner?.name,

        contextURL: session.workspace?.metadata?.originalContextUrl,
        contextURL_cloneURL: session.context?.repository?.cloneUrl,
        contextURLSegment_1: session?.context?.repository?.owner,
        contextURLSegment_2: session?.context?.repository?.name,

        workspaceType: displayWorkspaceType(session.workspace?.spec?.type),
        workspaceClass: session.workspace?.spec?.class,

        workspaceImageSize: session.metrics?.workspaceImageSize,
        workspaceImageTotalSize: session.metrics?.totalImageSize,

        timeout: session.workspace?.spec?.timeout?.inactivity?.seconds,
        editor: session.workspace?.spec?.editor?.name,
        editorVersion: session.workspace?.spec?.editor?.version, // indicates whether user selected the stable or latest editor release channel
    };

    return row;
};

export const useDownloadSessionsCSV = (args: Args) => {
    const client = useQueryClient();
    const key = getDownloadInsightsCSVQueryKey(args);

    const abort = useCallback(() => {
        client.removeQueries([key]);
    }, [client, key]);

    const query = useQuery<DownloadInsightsCSVResponse, Error>(
        key,
        async ({ signal }) => {
            return downloadInsightsCSV({ ...args, signal });
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

const getDownloadInsightsCSVQueryKey = (args: Args) => {
    return noPersistence(["insights-export", args]);
};
