/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { cn } from "@podkit/lib/cn";
import React from "react";

type HideableCellProps = {
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
                className="[&_th]:p-3 [&_th]:bg-gray-100 dark:[&_th]:bg-gray-800 [&_th:first-child]:rounded-tl-md [&_th:last-child]:rounded-tr-md text-semibold"
                {...props}
            />
        );
    },
);
TableHeader.displayName = "TableHeader";

export const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
    ({ className, ...props }, ref) => {
        return <tr ref={ref} className="border-b dark:border-gray-700" {...props} />;
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
            <tbody ref={ref} className="[&_td]:p-3 [&_td:last-child]:text-right [&_tr]:hover:bg-muted/5" {...props} />
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
