/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import React, { useCallback } from "react";
import { HideableCellProps, TableHead } from "./Table";
import { Button } from "@podkit/buttons/Button";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { cn } from "@podkit/lib/cn";

export type TableSortOrder = "asc" | "desc";

export type SortableTableHeadProps = {
    columnName: string;
    sortOrder?: TableSortOrder;
    onSort: (sortBy: string, sortOrder: TableSortOrder) => void;
} & HideableCellProps;
export const SortableTableHead = React.forwardRef<
    HTMLTableCellElement,
    React.HTMLAttributes<HTMLTableCellElement> & SortableTableHeadProps
>(({ columnName, sortOrder, children, onSort, ...props }, ref) => {
    const handleClick = useCallback(() => {
        onSort(columnName, sortOrder === "asc" ? "desc" : "asc");
    }, [onSort, columnName, sortOrder]);

    return (
        <TableHead
            ref={ref}
            {...props}
            aria-sort={sortOrder === "asc" ? "ascending" : sortOrder === "desc" ? "descending" : "none"}
        >
            <Button variant="ghost" onClick={handleClick} className="flex flex-row items-center gap-1">
                {children}
                {/* keep element in dom to preserve space */}
                <span className={cn(!sortOrder && "invisible")}>
                    {sortOrder === "asc" ? <ChevronUpIcon size={20} /> : <ChevronDownIcon size={20} />}
                </span>
            </Button>
        </TableHead>
    );
});
SortableTableHead.displayName = "SortableTableHead";
