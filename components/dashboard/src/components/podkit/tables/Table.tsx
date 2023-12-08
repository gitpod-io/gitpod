/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { cn } from "@podkit/lib/cn";
import React from "react";

export type HideableCellProps = {
    hideOnSmallScreen?: boolean;
};

export const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
    ({ className, ...props }, ref) => {
        return (
            <div className="relative w-full overflow-auto">
                <table ref={ref} className={cn("w-full text-sm text-left", className)} {...props} />
            </div>
        );
    },
);
Table.displayName = "Table";

export const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
    ({ className, ...props }, ref) => {
        return (
            <thead
                ref={ref}
                className={cn(
                    // extra padding on top to account for bottom border
                    "[&_th]:pb-2 [&_th]:pt-3 [&_th]:px-4",
                    "[&_th]:font-semibold",
                    "[&_th]:bg-pk-surface-tertiary",
                    "[&_th:first-child]:rounded-tl-md [&_th:last-child]:rounded-tr-md",
                )}
                {...props}
            />
        );
    },
);
TableHeader.displayName = "TableHeader";

export const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
    ({ className, ...props }, ref) => {
        return <tr ref={ref} className="border-b border-pk-border-base" {...props} />;
    },
);
TableRow.displayName = "TableRow";

export const TableHead = React.forwardRef<
    HTMLTableCellElement,
    React.ThHTMLAttributes<HTMLTableCellElement> & HideableCellProps
>(({ hideOnSmallScreen, className, ...props }, ref) => {
    return <th ref={ref} className={cn(hideOnSmallScreen && "hidden md:table-cell", className)} {...props} />;
});
TableHead.displayName = "TableHead";

export const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
    ({ className, ...props }, ref) => {
        return (
            <tbody
                ref={ref}
                className="[&_td]:py-3 [&_td]:px-4 [&_td:last-child]:text-right [&_tr]:hover:bg-muted/5"
                {...props}
            />
        );
    },
);
TableBody.displayName = "TableBody";

export const TableCell = React.forwardRef<
    HTMLTableCellElement,
    React.TdHTMLAttributes<HTMLTableCellElement> & HideableCellProps
>(({ hideOnSmallScreen, className, ...props }, ref) => {
    return <td ref={ref} className={cn(hideOnSmallScreen && "hidden md:table-cell", className)} {...props} />;
});
TableCell.displayName = "TableCell";
