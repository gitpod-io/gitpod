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

type Props = {
    configurationId: string;
    variable: ConfigurationEnvironmentVariable;
};
export const ConfigurationVariableItem = ({ variable, configurationId }: Props) => {
    const [showRemoveModal, setShowRemoveModal] = useState<boolean>(false);

    return (
        <>
            {showRemoveModal && (
                <ConfigurationDeleteVariableModal
                    variable={variable}
                    configurationId={configurationId}
                    onClose={() => setShowRemoveModal(false)}
                />
            )}
            <TableRow key={variable.id}>
                <TableCell className="break-all">{variable.name}</TableCell>
                <TableCell>
                    {variable.admission === EnvironmentVariableAdmission.PREBUILD
                        ? "Prebuilds only"
                        : "Prebuilds & workspaces"}
                </TableCell>
                <TableCell className="flex justify-end">
                    <DropdownActions>
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
