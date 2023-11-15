/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Button } from "@podkit/buttons/Button";
import { cn } from "@podkit/lib/cn";
import { TextMuted } from "@podkit/typography/TextMuted";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { FC, useCallback } from "react";

type Props = {
    currentPage: number;
    totalPages: number;
    pageSize: number;
    totalRows: number;
    currentRows: number;
    onPageChanged: (page: number) => void;
};
export const PaginationControls: FC<Props> = ({
    currentPage,
    totalPages,
    pageSize,
    totalRows,
    currentRows,
    onPageChanged,
}) => {
    const prevPage = useCallback(() => {
        onPageChanged(currentPage - 1);
    }, [currentPage, onPageChanged]);

    const nextPage = useCallback(() => {
        onPageChanged(currentPage + 1);
    }, [currentPage, onPageChanged]);

    return (
        <div className="flex flex-row justify-center items-center py-2 gap-2 text-sm">
            {/* TODO: Rows per page select */}
            <PaginationCountText
                className="w-24"
                currentPage={currentPage}
                pageSize={pageSize}
                currentRows={currentRows}
                totalRows={totalRows}
            />
            <Button variant="ghost" size="icon" onClick={prevPage} disabled={currentPage === 1}>
                <ChevronLeftIcon size={20} />
            </Button>
            <Button variant="ghost" size="icon" onClick={nextPage} disabled={currentPage >= totalPages}>
                <ChevronRightIcon size={20} />
            </Button>
        </div>
    );
};

type PaginationCountTextProps = {
    currentPage: number;
    pageSize: number;
    currentRows: number;
    totalRows: number;
    className?: string;
    includePrefix?: boolean;
};
export const PaginationCountText: FC<PaginationCountTextProps> = ({
    currentPage,
    pageSize,
    currentRows,
    totalRows,
    className,
    includePrefix = false,
}) => {
    const start = (currentPage - 1) * pageSize + 1;
    const end = start + currentRows - 1;

    return (
        <TextMuted className={cn("min-w-max text-right", className)}>
            {includePrefix ? `Showing ${start} - ${end} of ${totalRows}` : `${start} - ${end} of ${totalRows}`}
        </TextMuted>
    );
};
