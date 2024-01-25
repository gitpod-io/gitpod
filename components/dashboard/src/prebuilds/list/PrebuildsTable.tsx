/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC } from "react";
import { TextInput } from "../../components/forms/TextInputField";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@podkit/tables/Table";
import { RepositoryListItem } from "./PrebuildListItem";
import { LoadingButton } from "@podkit/buttons/LoadingButton";
import { TextMuted } from "@podkit/typography/TextMuted";
import { Subheading } from "@podkit/typography/Headings";
import { cn } from "@podkit/lib/cn";
import { LoadingState } from "@podkit/loading/LoadingState";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@podkit/select/Select";
import { Prebuild } from "@gitpod/public-api/lib/gitpod/v1/prebuild_pb";

type Props = {
    prebuilds: Prebuild[];
    searchTerm: string;
    hasNextPage: boolean;
    hasMoreThanOnePage: boolean;
    isSearching: boolean;
    isFetchingNextPage: boolean;
    onSearchTermChange: (val: string) => void;
    onLoadNextPage: () => void;
};

export const PrebuildsTable: FC<Props> = ({
    searchTerm,
    prebuilds,
    hasNextPage,
    hasMoreThanOnePage,
    isSearching,
    isFetchingNextPage,
    onSearchTermChange,
    onLoadNextPage,
}) => {
    return (
        <>
            {/* Search/Filter bar */}
            <div className="flex flex-col-reverse md:flex-row flex-wrap justify-between items-center gap-2">
                <div className="flex flex-row flex-wrap gap-2 items-center w-full md:w-auto">
                    {/* TODO: Add search icon on left - need to revisit TextInputs for podkit - and remove global styles */}
                    <TextInput
                        className="w-full max-w-none md:w-80"
                        value={searchTerm}
                        type="search"
                        onChange={onSearchTermChange}
                        placeholder="Search prebuilds"
                    />
                    {/* todo: add filtering logic */}
                    <Select>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Prebuild status: Any" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Any status</SelectItem>
                            <SelectItem value="failing">Failing</SelectItem>
                            <SelectItem value="succeeding">Succeeding</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <div className="relative w-full overflow-auto mt-4">
                {prebuilds.length > 0 ? (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-52">Repository</TableHead>
                                <TableHead hideOnSmallScreen>Commit</TableHead>
                                <TableHead className="w-32" hideOnSmallScreen>
                                    Triggered
                                </TableHead>
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
                            {prebuilds.map((configuration) => {
                                return <RepositoryListItem key={configuration.id} prebuild={configuration} />;
                            })}
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
