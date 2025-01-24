/**
 * Copyright (c) 2025 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FunctionComponent, useCallback } from "react";
import { useToast } from "../../components/toasts/Toasts";
import ConfirmationModal from "../../components/ConfirmationModal";
import type { OrganizationEnvironmentVariable } from "@gitpod/public-api/lib/gitpod/v1/envvar_pb";
import { useDeleteOrganizationEnvironmentVariable } from "../../data/organizations/org-envvar-queries";

type Props = {
    variable: OrganizationEnvironmentVariable;
    organizationId: string;
    onClose(): void;
};
export const OrganizationRemoveEnvvarModal: FunctionComponent<Props> = ({ variable, organizationId, onClose }) => {
    const deleteVariable = useDeleteOrganizationEnvironmentVariable();
    const { toast } = useToast();

    const handleConfirmation = useCallback(() => {
        deleteVariable.mutate(
            { variableId: variable.id, organizationId },
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
    }, [organizationId, deleteVariable, onClose, toast, variable.id]);

    return (
        <ConfirmationModal
            title="Delete variable"
            areYouSureText="Are you sure you want to delete this variable?"
            children={{
                name: variable.name,
            }}
            buttonText="Delete variable"
            warningText={deleteVariable.isError ? "There was a problem deleting this variable." : undefined}
            onClose={onClose}
            onConfirm={handleConfirmation}
            visible
        />
    );
};
