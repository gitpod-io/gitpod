/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useState } from "react";
import { ConfigurationSettingsField } from "../ConfigurationSettingsField";
import type { Configuration } from "@gitpod/public-api/lib/gitpod/v1/configuration_pb";
import { Button } from "@podkit/buttons/Button";
import { AddVariableModal } from "./ConfigurationAddVariableModal";
import { Heading2, Subheading } from "@podkit/typography/Headings";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@podkit/tables/Table";
import { DropdownActions } from "@podkit/dropdown/DropDownActions";
import { DropdownMenuItem } from "@radix-ui/react-dropdown-menu";
import { useListConfigurationVariables } from "../../../data/configurations/configuration-queries";
import { LoadingState } from "@podkit/loading/LoadingState";
import { EnvironmentVariableAdmission } from "@gitpod/public-api/lib/gitpod/v1/envvar_pb";

type Props = {
    configuration: Configuration;
};

export const ConfigurationVariableList = ({ configuration }: Props) => {
    const { data, isLoading } = useListConfigurationVariables(configuration.id);
    const [showAddVariableModal, setShowAddVariableModal] = useState<boolean>(false);

    if (isLoading || !data) {
        return <LoadingState />;
    }

    return (
        <ConfigurationSettingsField>
            {showAddVariableModal && (
                <AddVariableModal
                    configuration={configuration}
                    onClose={() => {
                        setShowAddVariableModal(false);
                    }}
                />
            )}
            <div className="mb-2 flex">
                <div className="flex-grow">
                    <Heading2>Environment Variables</Heading2>
                    <Subheading>Manage repository-specific environment variables.</Subheading>
                </div>
            </div>
            {data.length === 0 ? (
                <div className="bg-gray-100 dark:bg-gray-800 rounded-xl w-full py-28 flex flex-col items-center justify-center space-y-3">
                    <Heading2 color="light">No environment variables are set</Heading2>
                    <Subheading className="text-center w-96">
                        All configuration-specific environment variables will be visible in prebuilds and optionally in
                        workspaces for this repository.
                    </Subheading>
                </div>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Visibility in Workspaces</TableHead>
                            <TableHead></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.map((variable) => {
                            return (
                                <TableRow key={variable.id}>
                                    <TableCell className="truncate">{variable.name}</TableCell>
                                    <TableCell>
                                        {variable.admission === EnvironmentVariableAdmission.PREBUILD
                                            ? "Hidden"
                                            : "Shown"}
                                    </TableCell>
                                    <TableCell className="flex justify-end">
                                        <DropdownActions>
                                            <DropdownMenuItem>Edit</DropdownMenuItem>
                                            <DropdownMenuItem
                                                className="text-red-600 dark:text-red-400 focus:text-red-800 dark:focus:text-red-300"
                                                onSelect={() => {
                                                    // setShowRemoveModal(true);
                                                }}
                                            >
                                                Delete
                                            </DropdownMenuItem>
                                        </DropdownActions>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            )}
            <Button className="my-4" onClick={() => setShowAddVariableModal(true)}>
                New Variable
            </Button>
        </ConfigurationSettingsField>
    );
};
