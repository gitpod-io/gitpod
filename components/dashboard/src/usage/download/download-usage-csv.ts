/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { ListUsageRequest } from "@gitpod/gitpod-protocol/lib/usage";
import { getAllUsageRecords } from "./get-usage-records";
import { UsageCSVRow, transformUsageRecord } from "./transform-usage-record";
import { saveAs } from "file-saver";
import dayjs from "dayjs";

type Args = Pick<ListUsageRequest, "attributionId" | "from" | "to"> & {
    orgName: string;
};

export const downloadUsageCSV = async ({ attributionId, from, to, orgName }: Args) => {
    const records = await getAllUsageRecords({
        attributionId,
        from,
        to,
    });

    if (records.length === 0) {
        return false;
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

    const start = dayjs(from).format("YYYYMMDD");
    const end = dayjs(to).format("YYYYMMDD");

    const filename = `gitpod-usage-${orgName}-${start}-${end}.csv`;

    saveAs(blob, filename);

    return true;
};
