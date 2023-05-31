/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useCallback } from "react";
import dayjs from "dayjs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ListUsageRequest } from "@gitpod/gitpod-protocol/lib/usage";
import { getAllUsageRecords } from "./get-usage-records";
import { UsageCSVRow, transformUsageRecord } from "./transform-usage-record";
import { noPersistence } from "../../data/setup";

type Args = Pick<ListUsageRequest, "attributionId" | "from" | "to"> & {
    orgName: string;
};

export type DownloadUsageCSVResponse = {
    blob: Blob | null;
    filename: string;
};

export const downloadUsageCSV = async (
    { attributionId, from, to, orgName }: Args,
    signal?: AbortSignal,
): Promise<DownloadUsageCSVResponse> => {
    const start = dayjs(from).format("YYYYMMDD");
    const end = dayjs(to).format("YYYYMMDD");
    const filename = `gitpod-usage-${orgName}-${start}-${end}.csv`;

    const records = await getAllUsageRecords(
        {
            attributionId,
            from,
            to,
        },
        signal,
    );

    if (records.length === 0) {
        return {
            blob: null,
            filename,
        };
    }

    const rows = records.map(transformUsageRecord).filter(Boolean) as UsageCSVRow[];
    const fields = Object.keys(rows[0]) as (keyof UsageCSVRow)[];

    // TODO: look into a lib to handle this more robustly
    // CSV Rows
    const csvRows = rows.map((row) => {
        const rowString = fields.map((fieldName) => JSON.stringify(row[fieldName])).join(",");

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
    };
};

export const useDownloadUsageCSV = (args: Args) => {
    const client = useQueryClient();
    const key = getDownloadUsageCSVQueryKey(args);

    const abort = useCallback(() => {
        client.removeQueries([key]);
    }, [client, key]);

    const query = useQuery<DownloadUsageCSVResponse, Error>(
        key,
        async ({ signal }) => {
            return await downloadUsageCSV(args, signal);
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
