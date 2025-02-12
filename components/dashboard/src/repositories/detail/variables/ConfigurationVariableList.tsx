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
import { Heading3, Subheading } from "@podkit/typography/Headings";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@podkit/tables/Table";
import { useListConfigurationVariables } from "../../../data/configurations/configuration-queries";
import { LoadingState } from "@podkit/loading/LoadingState";
import { ConfigurationVariableItem } from "./ConfigurationVariableItem";
import { EnableDockerdAuthentication } from "./EnableDockerdAuthentication";

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
        <>
            <ConfigurationSettingsField>
                {showAddVariableModal && (
                    <AddVariableModal
                        configurationId={configuration.id}
                        onClose={() => {
                            setShowAddVariableModal(false);
                        }}
                    />
                )}
                <div className="mb-2 flex">
                    <div className="flex-grow">
                        <Heading3>Environment variables</Heading3>
                        <Subheading>Manage repository-specific environment variables.</Subheading>
                    </div>
                </div>
                {data.length === 0 ? (
                    <div className="bg-pk-surface-secondary rounded-xl w-full p-6 flex flex-col justify-center space-y-3">
                        <span className="font-semi-bold text-base">No environment variables are set</span>
                        <span className="text-sm text-pk-content-secondary">
                            All repository-specific environment variables will be visible in prebuilds and optionally in
                            workspaces for this repository.
                        </span>
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead className="w-48">Visibility</TableHead>
                                <TableHead className="w-16"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.map((variable) => (
                                <ConfigurationVariableItem
                                    key={variable.id}
                                    configurationId={configuration.id}
                                    variable={variable}
                                />
                            ))}
                        </TableBody>
                    </Table>
                )}
                <Button className="mt-4" onClick={() => setShowAddVariableModal(true)}>
                    Add Variable
                </Button>
            </ConfigurationSettingsField>
            <EnableDockerdAuthentication configuration={configuration} />
        </>
    );
};
