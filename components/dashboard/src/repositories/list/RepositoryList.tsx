/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, useCallback, useState } from "react";
import { LoaderIcon } from "lucide-react";
import { useHistory } from "react-router-dom";
import { RepositoryListItem } from "./RepoListItem";
import { useListConfigurations } from "../../data/configurations/configuration-queries";
import { TextInput } from "../../components/forms/TextInputField";
import { PageHeading } from "@podkit/layout/PageHeading";
import { Button } from "@podkit/buttons/Button";
import { useDocumentTitle } from "../../hooks/use-document-title";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@podkit/tables/Table";
import { ImportRepositoryModal } from "../create/ImportRepositoryModal";
import type { Configuration } from "@gitpod/public-api/lib/gitpod/v1/configuration_pb";
import { LoadingButton } from "@podkit/buttons/LoadingButton";
import { useQueryParams } from "../../hooks/use-query-params";

const RepositoryListPage: FC = () => {
    useDocumentTitle("Imported repositories");

    const history = useHistory();

    // Search/Filter params tracked in url query params
    const params = useQueryParams();
    const searchTerm = params.get("search") || "";
    const updateSearchTerm = useCallback(
        (val: string) => {
            history.replace({ search: `?search=${encodeURIComponent(val)}` });
        },
        [history],
    );

    const { data, isFetching, isFetchingNextPage, isPreviousData, hasNextPage, fetchNextPage } = useListConfigurations({
        searchTerm,
    });
    const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);

    const handleRepoImported = useCallback(
        (configuration: Configuration) => {
            history.push(`/repositories/${configuration.id}`);
        },
        [history],
    );

    return (
        <>
            <div className="app-container mb-8">
                <PageHeading
                    title="Imported repositories"
                    subtitle="Configure and refine the experience of working with a repository in Gitpod"
                    action={<Button onClick={() => setShowCreateProjectModal(true)}>Import Repository</Button>}
                />

                {/* Search/Filter bar */}
                <div className="flex flex-row flex-wrap justify-between items-center">
                    <div className="flex flex-row flex-wrap gap-2 items-center">
                        {/* TODO: Add search icon on left and decide on pulling Inputs into podkit */}
                        <TextInput
                            className="w-80"
                            value={searchTerm}
                            onChange={updateSearchTerm}
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
                                    {isFetching && isPreviousData && (
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
                            {data?.pages.map((page) => {
                                return page.configurations.map((configuration) => {
                                    return <RepositoryListItem key={configuration.id} configuration={configuration} />;
                                });
                            })}
                        </TableBody>
                    </Table>

                    {hasNextPage && (
                        <div className="my-4 flex flex-row justify-center">
                            <LoadingButton onClick={() => fetchNextPage()} loading={isFetchingNextPage}>
                                Load more
                            </LoadingButton>
                        </div>
                    )}
                </div>
            </div>

            {showCreateProjectModal && (
                <ImportRepositoryModal
                    onClose={() => setShowCreateProjectModal(false)}
                    onCreated={handleRepoImported}
                />
            )}
        </>
    );
};

export default RepositoryListPage;
