/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FunctionComponent, useCallback } from "react";
import ConfirmationModal from "../components/ConfirmationModal";
import { useDeleteWorkspaceMutation } from "../data/workspaces/delete-workspace-mutation";
import { useToast } from "../components/toasts/Toasts";
import { Workspace } from "@gitpod/public-api/lib/gitpod/v1/workspace_pb";

type Props = {
    workspace: Workspace;
    onClose(): void;
};
export const DeleteWorkspaceModal: FunctionComponent<Props> = ({ workspace, onClose }) => {
    const deleteWorkspace = useDeleteWorkspaceMutation();
    const { toast } = useToast();

    const handleConfirmation = useCallback(async () => {
        try {
            await deleteWorkspace.mutateAsync({ workspaceId: workspace.id });

            toast("Your workspace was deleted");
            onClose();
        } catch (e) {}
    }, [deleteWorkspace, onClose, toast, workspace.id]);

    return (
        <ConfirmationModal
            title="Delete workspace"
            areYouSureText="Are you sure you want to delete this workspace?"
            children={{
                name: workspace.id,
                description: workspace.metadata?.name,
            }}
            buttonText="Delete workspace"
            warningText={deleteWorkspace.isError ? "There was a problem deleting your workspace." : undefined}
            onClose={onClose}
            onConfirm={handleConfirmation}
            visible
        />
    );
};
