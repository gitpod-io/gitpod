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
import { transformUsageRecord, UsageCSVRow } from "./transform-usage-record";
import { noPersistence } from "../../data/setup";

type Args = Pick<ListUsageRequest, "attributionId" | "from" | "to"> & {
    orgName: string;
    signal?: AbortSignal;
    onProgress?: (percentage: number) => void;
};

export type DownloadUsageCSVResponse = {
    blob: Blob | null;
    filename: string;
    count: number;
};

const downloadUsageCSV = async ({
    attributionId,
    from,
    to,
    orgName,
    signal,
    onProgress,
}: Args): Promise<DownloadUsageCSVResponse> => {
    const start = dayjs(from).format("YYYYMMDD");
    const end = dayjs(to).format("YYYYMMDD");
    const filename = `gitpod-usage-${orgName}-${start}-${end}.csv`;

    const records = await getAllUsageRecords({
        attributionId,
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

    const rows = records.map(transformUsageRecord).filter((r) => !!r);
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
        count: rows.length,
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
