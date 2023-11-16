/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FunctionComponent, useCallback } from "react";
import { useDeleteWorkspaceMutation } from "../../../data/workspaces/delete-workspace-mutation";
import { useToast } from "../../../components/toasts/Toasts";
import ConfirmationModal from "../../../components/ConfirmationModal";
import type { WorkspaceEnvironmentVariable } from "@gitpod/public-api/lib/gitpod/v1/workspace_pb";

type Props = {
    variable: WorkspaceEnvironmentVariable;
    onClose(): void;
};
export const DeleteWorkspaceModal: FunctionComponent<Props> = ({ variable, onClose }) => {
    const deleteWorkspace = useDeleteWorkspaceMutation();
    const { toast } = useToast();

    const handleConfirmation = useCallback(async () => {
        try {
            await deleteWorkspace.mutateAsync({ workspaceId: variable.id });

            toast("Your workspace was deleted");
            onClose();
        } catch (e) {}
    }, [deleteWorkspace, onClose, toast, variable.id]);

    return (
        <ConfirmationModal
            title="Delete variable"
            areYouSureText="Are you sure you want to delete this variable?"
            children={{
                name: variable.id,
                description: variable.description,
            }}
            buttonText="Delete Workspace"
            warningText={deleteWorkspace.isError ? "There was a problem deleting your workspace." : undefined}
            onClose={onClose}
            onConfirm={handleConfirmation}
            visible
        />
    );
};
