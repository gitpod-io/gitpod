/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import {
    ConfigurationEnvironmentVariable,
    EnvironmentVariableAdmission,
} from "@gitpod/public-api/lib/gitpod/v1/envvar_pb";
import { DropdownActions } from "@podkit/dropdown/DropDownActions";
import { TableRow, TableCell } from "@podkit/tables/Table";
import { useState } from "react";
import { ConfigurationDeleteVariableModal } from "./ConfigurationRemoveVariableModal";
import { DropdownMenuItem } from "@podkit/dropdown/DropDown";
import { ModifyVariableModal } from "./ConfigurationAddVariableModal";

type Props = {
    configurationId: string;
    variable: ConfigurationEnvironmentVariable;
};
export const ConfigurationVariableItem = ({ variable, configurationId }: Props) => {
    const [showRemoveModal, setShowRemoveModal] = useState<boolean>(false);
    const [showEditModal, setShowEditModal] = useState<boolean>(false);

    return (
        <>
            {showEditModal && (
                <ModifyVariableModal
                    configurationId={configurationId}
                    variable={variable}
                    onClose={() => setShowEditModal(false)}
                />
            )}
            {showRemoveModal && (
                <ConfigurationDeleteVariableModal
                    variable={variable}
                    configurationId={configurationId}
                    onClose={() => setShowRemoveModal(false)}
                />
            )}
            <TableRow key={variable.id}>
                <TableCell className="truncate">{variable.name}</TableCell>
                <TableCell>
                    {variable.admission === EnvironmentVariableAdmission.PREBUILD ? "Hidden" : "Shown"}
                </TableCell>
                <TableCell className="flex justify-end">
                    <DropdownActions>
                        <DropdownMenuItem onSelect={() => setShowEditModal(true)}>Edit</DropdownMenuItem>
                        <DropdownMenuItem
                            className="text-red-600 dark:text-red-400 focus:text-red-800 dark:focus:text-red-300"
                            onSelect={() => {
                                setShowRemoveModal(true);
                            }}
                        >
                            Delete
                        </DropdownMenuItem>
                    </DropdownActions>
                </TableCell>
            </TableRow>
        </>
    );
};
