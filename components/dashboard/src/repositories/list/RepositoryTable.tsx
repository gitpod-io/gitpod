/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC } from "react";
import { TextInput } from "../../components/forms/TextInputField";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@podkit/tables/Table";
import { RepositoryListItem } from "./RepoListItem";
import { LoadingButton } from "@podkit/buttons/LoadingButton";
import { Configuration } from "@gitpod/public-api/lib/gitpod/v1/configuration_pb";
import { TextMuted } from "@podkit/typography/TextMuted";
import { Subheading } from "@podkit/typography/Headings";
import { cn } from "@podkit/lib/cn";
import { SortableTableHead, TableSortOrder } from "@podkit/tables/SortableTable";
import { LoadingState } from "@podkit/loading/LoadingState";
import { Button } from "@podkit/buttons/Button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@podkit/select/Select";
import { useOrgSettingsQuery } from "../../data/organizations/org-settings-query";

type Props = {
    configurations: Configuration[];
    searchTerm: string;
    prebuildsFilter: string;
    sortBy: string;
    sortOrder: TableSortOrder;
    hasNextPage: boolean;
    hasMoreThanOnePage: boolean;
    isSearching: boolean;
    isFetchingNextPage: boolean;
    onImport: () => void;
    onSearchTermChange: (val: string) => void;
    onPrebuildsFilterChange: (val: "all" | "enabled" | "disabled") => void;
    onLoadNextPage: () => void;
    onSort: (columnName: string, direction: TableSortOrder) => void;
};

export const RepositoryTable: FC<Props> = ({
    searchTerm,
    prebuildsFilter,
    configurations,
    sortOrder,
    sortBy,
    hasNextPage,
    hasMoreThanOnePage,
    isSearching,
    isFetchingNextPage,
    onImport,
    onSearchTermChange,
    onPrebuildsFilterChange,
    onLoadNextPage,
    onSort,
}) => {
    const { data: settings } = useOrgSettingsQuery();

    return (
        <>
            {/* Search/Filter bar */}
            <div className="flex flex-col-reverse md:flex-row flex-wrap justify-between items-center gap-2">
                <div className="flex flex-row flex-wrap gap-2 items-center w-full md:w-auto">
                    {/* TODO: Add search icon on left - need to revisit TextInputs for podkit - and remove global styles */}
                    <TextInput
                        className="w-full max-w-none md:w-80"
                        value={searchTerm}
                        onChange={onSearchTermChange}
                        placeholder="Search repositories"
                    />
                    <Select value={prebuildsFilter} onValueChange={onPrebuildsFilterChange}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Prebuilds: All" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Prebuilds: All</SelectItem>
                            <SelectItem value="enabled">Prebuilds: Enabled</SelectItem>
                            <SelectItem value="disabled">Prebuilds: Disabled</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* TODO: Consider making all podkit buttons behave this way, full width on small screen */}
                <Button className="w-full md:w-auto" onClick={onImport}>
                    Add Repository
                </Button>
            </div>
            <div className="relative w-full overflow-auto mt-4">
                {configurations.length > 0 ? (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <SortableTableHead
                                    className="w-auto md:w-64"
                                    columnName="name"
                                    sortOrder={sortBy === "name" ? sortOrder : undefined}
                                    onSort={onSort}
                                >
                                    Name
                                </SortableTableHead>
                                <TableHead hideOnSmallScreen>Repository</TableHead>
                                <SortableTableHead
                                    className="w-32"
                                    columnName="creationTime"
                                    sortOrder={sortBy === "creationTime" ? sortOrder : undefined}
                                    onSort={onSort}
                                    hideOnSmallScreen
                                >
                                    Created
                                </SortableTableHead>
                                <TableHead className="w-24" hideOnSmallScreen>
                                    Prebuilds
                                </TableHead>
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
                            {configurations.map((configuration) => {
                                return (
                                    <RepositoryListItem
                                        key={configuration.id}
                                        configuration={configuration}
                                        isSuggested={
                                            settings?.onboardingSettings?.recommendedRepositories.includes(
                                                configuration.id,
                                            ) ?? false
                                        }
                                    />
                                );
                            })}
                        </TableBody>
                    </Table>
                ) : (
                    <div
                        className={cn(
                            "w-full flex justify-center rounded-xl bg-pk-surface-secondary px-4 py-10 animate-fade-in-fast",
                        )}
                    >
                        <Subheading className="max-w-md">No results found. Try adjusting your search terms.</Subheading>
                    </div>
                )}

                <div className="mt-4 flex flex-row justify-center">
                    {hasNextPage ? (
                        <LoadingButton variant="secondary" onClick={onLoadNextPage} loading={isFetchingNextPage}>
                            Load more
                        </LoadingButton>
                    ) : (
                        hasMoreThanOnePage && <TextMuted>All repositories are loaded</TextMuted>
                    )}
                </div>
            </div>
        </>
    );
};
