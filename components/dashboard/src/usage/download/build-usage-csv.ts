/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { ListUsageRequest } from "@gitpod/gitpod-protocol/lib/usage";
import { getAllUsageRecords } from "./get-usage-records";
import { UsageCSVRow, transformUsageRecord } from "./transform-usage-record";
import { saveAs } from "file-saver";

type Args = Pick<ListUsageRequest, "attributionId" | "from" | "to">;

export const buildUsageCSV = async ({ attributionId, from, to }: Args) => {
    const records = await getAllUsageRecords({
        attributionId,
        from,
        to,
    });

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

    // TODO: generate filename based on args
    const filename = `usage.csv`;

    saveAs(blob, filename);
};
