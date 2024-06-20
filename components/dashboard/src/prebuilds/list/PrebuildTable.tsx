/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC } from "react";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@podkit/tables/Table";
import { PrebuildListItem } from "./PrebuildListItem";
import { LoadingButton } from "@podkit/buttons/LoadingButton";
import { TextMuted } from "@podkit/typography/TextMuted";
import { Subheading } from "@podkit/typography/Headings";
import { cn } from "@podkit/lib/cn";
import { LoadingState } from "@podkit/loading/LoadingState";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@podkit/select/Select";
import { Prebuild } from "@gitpod/public-api/lib/gitpod/v1/prebuild_pb";
import { Filter, Sort, SortField, StatusOption } from "./PrebuildList";
import { SortCallback, SortableTableHead, TableSortOrder } from "@podkit/tables/SortableTable";
import { ConfigurationDropdown } from "../configuration-input/ConfigurationInput";
import { Button } from "@podkit/buttons/Button";

type Props = {
    prebuilds: Prebuild[];
    filter?: Filter;
    sort: Sort;
    hasNextPage: boolean;
    hasMoreThanOnePage: boolean;
    isSearching: boolean;
    isFetchingNextPage: boolean;
    /**
     * If true, the configuration dropdown and the "Run Prebuild" button will be hidden.
     */
    hideOrgSpecificControls: boolean;
    onFilterChange: (val: Filter) => void;
    onLoadNextPage: () => void;
    onSort: (columnName: SortField, direction: TableSortOrder) => void;
    onTriggerPrebuild: () => void;
};
export const PrebuildsTable: FC<Props> = ({
    prebuilds,
    hasNextPage,
    hasMoreThanOnePage,
    isSearching,
    isFetchingNextPage,
    filter,
    sort,
    hideOrgSpecificControls,
    onFilterChange,
    onLoadNextPage,
    onSort,
    onTriggerPrebuild,
}) => {
    return (
        <>
            {/* Search/Filter bar */}
            <div className="flex flex-col-reverse md:flex-row flex-wrap justify-between items-center gap-2">
                <div className="flex flex-row flex-wrap gap-2 items-center w-full md:w-auto">
                    {!hideOrgSpecificControls && (
                        <ConfigurationDropdown
                            selectedConfigurationId={filter?.configurationId}
                            onChange={(configurationId) => {
                                onFilterChange({ ...filter, configurationId });
                            }}
                        />
                    )}
                    <Select
                        value={filter?.status ?? "any"}
                        onValueChange={(status) => {
                            if (status === "any") {
                                onFilterChange({ ...filter, status: undefined });
                                return;
                            }
                            onFilterChange({ ...filter, status: status as StatusOption });
                        }}
                    >
                        <SelectTrigger className="w-[120px]">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="any">All</SelectItem>
                            <SelectItem value="failed">Failing</SelectItem>
                            <SelectItem value="succeeded">Successful</SelectItem>
                            <SelectItem value="unfinished">In progress</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                {!hideOrgSpecificControls && (
                    <Button className="w-full md:w-auto" onClick={onTriggerPrebuild}>
                        Run prebuild
                    </Button>
                )}
            </div>
            <div className="relative w-full overflow-auto mt-4">
                {prebuilds.length > 0 ? (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-52">Repository</TableHead>
                                <TableHead hideOnSmallScreen>Commit</TableHead>
                                <SortableTableHead
                                    columnName={sort.sortBy}
                                    sortOrder={sort.sortOrder}
                                    onSort={onSort as SortCallback}
                                    className="w-40"
                                    hideOnSmallScreen
                                >
                                    Triggered
                                </SortableTableHead>
                                <TableHead className="w-24">Status</TableHead>
                                {/* Action column, loading status in header */}
                                <TableHead className="w-24 text-right">
                                    {isSearching && (
                                        <div className="flex flex-right justify-end items-center">
                                            <LoadingState delay={false} size={16} />
                                        </div>
                                    )}
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {prebuilds.map((configuration) => (
                                <PrebuildListItem key={configuration.id} prebuild={configuration} />
                            ))}
                        </TableBody>
                    </Table>
                ) : (
                    <div
                        className={cn(
                            "w-full flex justify-center rounded-xl bg-gray-100 dark:bg-gray-800 px-4 py-10 animate-fade-in-fast",
                        )}
                    >
                        <Subheading className="max-w-md">No results found. Try adjusting your search terms.</Subheading>
                    </div>
                )}

                <div className="mt-4 mb-8 flex flex-row justify-center">
                    {hasNextPage ? (
                        <LoadingButton variant="secondary" onClick={onLoadNextPage} loading={isFetchingNextPage}>
                            Load more
                        </LoadingButton>
                    ) : (
                        hasMoreThanOnePage && <TextMuted>All prebuilds are loaded</TextMuted>
                    )}
                </div>
            </div>
        </>
    );
};
