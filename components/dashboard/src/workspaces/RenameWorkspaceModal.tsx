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

type Props = {
    workspace: Workspace;
    onClose(): void;
};
export const RenameWorkspaceModal: FunctionComponent<Props> = ({ workspace, onClose }) => {
    const [errorMessage, setErrorMessage] = useState("");
    const [name, setName] = useState(workspace.metadata?.name || "");
    const updateWorkspace = useUpdateWorkspaceMutation();

    const updateWorkspaceDescription = useCallback(async () => {
        try {
            if (name.length === 0) {
                setErrorMessage("Description cannot not be empty.");
                return;
            }

            if (name.length > 250) {
                setErrorMessage("Description is too long for readability.");
                return;
            }

            setErrorMessage("");

            // Using mutateAsync here so we can close the modal after it completes successfully
            await updateWorkspace.mutateAsync({ workspaceId: workspace.id, metadata: { name } });

            // Close the modal
            onClose();
        } catch (error) {
            setErrorMessage("Something went wrong. Please try renaming again.");
        }
    }, [name, onClose, updateWorkspace, workspace.id]);

    return (
        <Modal visible onClose={onClose} onSubmit={updateWorkspaceDescription}>
            <ModalHeader>Rename workspace description</ModalHeader>
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
                    <p className="text-gray-500">Change the description to make it easier to go back to a workspace.</p>
                    <p className="text-gray-500">Workspace URLs and endpoints will remain the same.</p>
                </div>
            </ModalBody>
            <ModalFooter>
                <Button variant="secondary" disabled={updateWorkspace.isLoading} onClick={onClose}>
                    Cancel
                </Button>
                <LoadingButton type="submit" loading={updateWorkspace.isLoading}>
                    Update description
                </LoadingButton>
            </ModalFooter>
        </Modal>
    );
};
