/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Workspace } from "@gitpod/gitpod-protocol";
import { FunctionComponent, useCallback } from "react";
import ConfirmationModal from "../components/ConfirmationModal";
import { useDeleteWorkspaceMutation } from "../data/workspaces/delete-workspace-mutation";

type Props = {
    workspace: Workspace;
    onClose(): void;
};
export const DeleteWorkspaceModal: FunctionComponent<Props> = ({ workspace, onClose }) => {
    const deleteWorkspace = useDeleteWorkspaceMutation();

    const handleConfirmation = useCallback(async () => {
        try {
            await deleteWorkspace.mutateAsync({ workspaceId: workspace.id });
            onClose();
        } catch (e) {
            console.error(e);
        }
    }, [deleteWorkspace, onClose, workspace.id]);

    return (
        <ConfirmationModal
            title="Delete Workspace"
            areYouSureText="Are you sure you want to delete this workspace?"
            children={{
                name: workspace.id,
                description: workspace.description,
            }}
            buttonText="Delete Workspace"
            warningText={deleteWorkspace.isError ? "There was a problem deleting your workspace." : undefined}
            visible
            buttonDisabled={deleteWorkspace.isLoading}
            onClose={onClose}
            onConfirm={handleConfirmation}
        />
    );
};
