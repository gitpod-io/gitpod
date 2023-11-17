/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC } from "react";
import { TextInput } from "../../components/forms/TextInputField";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@podkit/tables/Table";
import { LoaderIcon } from "lucide-react";
import { RepositoryListItem } from "./RepoListItem";
import { LoadingButton } from "@podkit/buttons/LoadingButton";
import { Configuration } from "@gitpod/public-api/lib/gitpod/v1/configuration_pb";

type Props = {
    configurations: Configuration[];
    searchTerm: string;
    hasNextPage: boolean;
    isSearching: boolean;
    isFetchingNextPage: boolean;
    onSearchTermChange: (val: string) => void;
    onLoadNextPage: () => void;
};

export const RepositoryTable: FC<Props> = ({
    searchTerm,
    configurations,
    hasNextPage,
    isSearching,
    isFetchingNextPage,
    onSearchTermChange,
    onLoadNextPage,
}) => {
    return (
        <>
            {/* Search/Filter bar */}
            <div className="flex flex-row flex-wrap justify-between items-center">
                <div className="flex flex-row flex-wrap gap-2 items-center">
                    {/* TODO: Add search icon on left and decide on pulling Inputs into podkit */}
                    <TextInput
                        className="w-80"
                        value={searchTerm}
                        onChange={onSearchTermChange}
                        placeholder="Search imported repositories"
                    />
                    {/* TODO: Add prebuild status filter dropdown */}
                </div>
                {/* Account for variation of message when totalRows is greater than smallest page size option (20?) */}
            </div>
            <div className="relative w-full overflow-auto mt-2">
                <Table>
                    {/* TODO: Add sorting controls */}
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-52">Name</TableHead>
                            <TableHead hideOnSmallScreen>Repository</TableHead>
                            <TableHead className="w-32" hideOnSmallScreen>
                                Created
                            </TableHead>
                            <TableHead className="w-24" hideOnSmallScreen>
                                Prebuilds
                            </TableHead>
                            {/* Action column, loading status in header */}
                            <TableHead className="w-24 text-right">
                                {isSearching && (
                                    <div className="flex flex-right justify-end items-center">
                                        {/* TODO: Make a LoadingIcon component */}
                                        <LoaderIcon
                                            className="animate-spin text-gray-500 dark:text-gray-300"
                                            size={20}
                                        />
                                    </div>
                                )}
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {configurations.map((configuration) => {
                            return <RepositoryListItem key={configuration.id} configuration={configuration} />;
                        })}
                    </TableBody>
                </Table>

                {configurations.length === 0 && <div className="flex flex-row justify-center my-4">No results</div>}

                <div className="my-4 flex flex-row justify-center">
                    {hasNextPage ? (
                        <LoadingButton variant="secondary" onClick={onLoadNextPage} loading={isFetchingNextPage}>
                            Load more
                        </LoadingButton>
                    ) : (
                        // TODO: get the actual copy from Cory
                        <span>That's all folks</span>
                    )}
                </div>
            </div>
        </>
    );
};
