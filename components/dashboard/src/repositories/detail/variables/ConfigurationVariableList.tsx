/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useState } from "react";
import { ConfigurationSettingsField } from "../ConfigurationSettingsField";
import type { Configuration } from "@gitpod/public-api/lib/gitpod/v1/configuration_pb";
import { Button } from "@podkit/buttons/Button";
import { ModifyVariableModal } from "./ConfigurationAddVariableModal";
import { Heading2, Subheading } from "@podkit/typography/Headings";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@podkit/tables/Table";
import { useListConfigurationVariables } from "../../../data/configurations/configuration-queries";
import { LoadingState } from "@podkit/loading/LoadingState";
import { ConfigurationVariableItem } from "./ConfigurationVariableItem";

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
                <ModifyVariableModal
                    configurationId={configuration.id}
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
                <div className="bg-gray-100 dark:bg-gray-800 rounded-xl w-full p-6 flex flex-col justify-center space-y-3">
                    <span className="font-bold text-base">No environment variables are set</span>
                    {/* todo: change to podkit color abstractions */}
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                        All configuration-specific environment variables will be visible in prebuilds and optionally in
                        workspaces for this repository.
                    </span>
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
                        {data.map((variable) => (
                            <ConfigurationVariableItem configurationId={configuration.id} variable={variable} />
                        ))}
                    </TableBody>
                </Table>
            )}
            <Button className="my-4" onClick={() => setShowAddVariableModal(true)}>
                New Variable
            </Button>
        </ConfigurationSettingsField>
    );
};
