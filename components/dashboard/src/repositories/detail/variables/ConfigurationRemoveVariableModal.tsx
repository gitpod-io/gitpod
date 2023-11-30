/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FunctionComponent, useCallback } from "react";
import { useToast } from "../../../components/toasts/Toasts";
import ConfirmationModal from "../../../components/ConfirmationModal";
import { useDeleteConfigurationVariable } from "../../../data/configurations/configuration-queries";
import type { ConfigurationEnvironmentVariable } from "@gitpod/public-api/lib/gitpod/v1/envvar_pb";

type Props = {
    variable: ConfigurationEnvironmentVariable;
    configurationId: string;
    onClose(): void;
};
export const ConfigurationDeleteVariableModal: FunctionComponent<Props> = ({ variable, configurationId, onClose }) => {
    const deleteVariable = useDeleteConfigurationVariable();
    const { toast } = useToast();

    const handleConfirmation = useCallback(() => {
        deleteVariable.mutate(
            { variableId: variable.id, configurationId },
            {
                onSuccess: () => {
                    toast("Your variable was deleted");
                    onClose();
                },
                onError: (err) => {
                    toast(`Could not delete variable: ${err.message}`);
                },
            },
        );
    }, [configurationId, deleteVariable, onClose, toast, variable.id]);

    return (
        <ConfirmationModal
            title="Delete variable"
            areYouSureText="Are you sure you want to delete this variable?"
            children={{
                name: variable.name,
            }}
            buttonText="Delete Variable"
            warningText={deleteVariable.isError ? "There was a problem deleting this variable." : undefined}
            onClose={onClose}
            onConfirm={handleConfirmation}
            visible
        />
    );
};
