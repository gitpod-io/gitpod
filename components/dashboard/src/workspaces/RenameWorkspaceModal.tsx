/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FunctionComponent, useCallback, useState } from "react";
import Modal, { ModalBody, ModalFooter, ModalHeader } from "../components/Modal";
import { Button } from "@podkit/buttons/Button";
import { Workspace } from "@gitpod/public-api/lib/gitpod/v1/workspace_pb";
import { useUpdateWorkspaceMutation } from "../data/workspaces/update-workspace-mutation";
import { LoadingButton } from "@podkit/buttons/LoadingButton";
import { Workspace as WorkspaceProtocol } from "@gitpod/gitpod-protocol";

export function toWorkspaceName(name: string): string {
    return WorkspaceProtocol.toWorkspaceName(name);
}

export function fromWorkspaceName(workspace?: Workspace): string | undefined {
    return WorkspaceProtocol.fromWorkspaceName(workspace?.metadata?.name);
}

type Props = {
    workspace: Workspace;
    onClose(): void;
};
export const RenameWorkspaceModal: FunctionComponent<Props> = ({ workspace, onClose }) => {
    const [errorMessage, setErrorMessage] = useState("");
    const [name, setName] = useState(fromWorkspaceName(workspace) || "");
    const updateWorkspace = useUpdateWorkspaceMutation();

    const updateWorkspaceDescription = useCallback(async () => {
        try {
            if (name.length > 250) {
                setErrorMessage("Name is too long for readability.");
                return;
            }

            setErrorMessage("");

            // Using mutateAsync here so we can close the modal after it completes successfully
            await updateWorkspace.mutateAsync({ workspaceId: workspace.id, metadata: { name: toWorkspaceName(name) } });

            // Close the modal
            onClose();
        } catch (error) {
            setErrorMessage("Something went wrong. Please try renaming again.");
        }
    }, [name, onClose, updateWorkspace, workspace.id]);

    return (
        <Modal visible onClose={onClose} onSubmit={updateWorkspaceDescription}>
            <ModalHeader>Rename Workspace</ModalHeader>
            <ModalBody>
                {errorMessage.length > 0 ? (
                    <div className="bg-kumquat-light rounded-md p-3 text-gitpod-red text-sm mb-2">{errorMessage}</div>
                ) : null}
                <input
                    autoFocus
                    className="w-full truncate"
                    type="text"
                    value={name}
                    disabled={updateWorkspace.isLoading}
                    onChange={(e) => setName(e.target.value)}
                />
                <div className="mt-1">
                    <p className="text-gray-500">Change the name to better identify the workspace.</p>
                    <p className="text-gray-500">Workspace URLs and endpoints will remain the same.</p>
                </div>
            </ModalBody>
            <ModalFooter>
                <Button variant="secondary" disabled={updateWorkspace.isLoading} onClick={onClose}>
                    Cancel
                </Button>
                <LoadingButton type="submit" loading={updateWorkspace.isLoading}>
                    Update Name
                </LoadingButton>
            </ModalFooter>
        </Modal>
    );
};
