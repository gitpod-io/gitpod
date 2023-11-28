/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FunctionComponent, useCallback, useState } from "react";
import Modal, { ModalBody, ModalFooter, ModalHeader } from "../components/Modal";
import { useUpdateWorkspaceDescriptionMutation } from "../data/workspaces/update-workspace-description-mutation";
import { Button } from "../components/Button";
import { Workspace } from "@gitpod/public-api/lib/gitpod/v1/workspace_pb";

type Props = {
    workspace: Workspace;
    onClose(): void;
};
export const RenameWorkspaceModal: FunctionComponent<Props> = ({ workspace, onClose }) => {
    const [errorMessage, setErrorMessage] = useState("");
    const [description, setDescription] = useState(workspace.name || "");
    const updateDescription = useUpdateWorkspaceDescriptionMutation();

    const updateWorkspaceDescription = useCallback(async () => {
        try {
            if (description.length === 0) {
                setErrorMessage("Description cannot not be empty.");
                return;
            }

            if (description.length > 250) {
                setErrorMessage("Description is too long for readability.");
                return;
            }

            setErrorMessage("");

            // Using mutateAsync here so we can close the modal after it completes successfully
            await updateDescription.mutateAsync({ workspaceId: workspace.id, newDescription: description });

            // Close the modal
            onClose();
        } catch (error) {
            setErrorMessage("Something went wrong. Please try renaming again.");
        }
    }, [description, onClose, updateDescription, workspace.id]);

    return (
        <Modal visible onClose={onClose} onSubmit={updateWorkspaceDescription}>
            <ModalHeader>Rename Workspace Description</ModalHeader>
            <ModalBody>
                {errorMessage.length > 0 ? (
                    <div className="bg-kumquat-light rounded-md p-3 text-gitpod-red text-sm mb-2">{errorMessage}</div>
                ) : null}
                <input
                    className="w-full truncate"
                    type="text"
                    value={description}
                    disabled={updateDescription.isLoading}
                    onChange={(e) => setDescription(e.target.value)}
                />
                <div className="mt-1">
                    <p className="text-gray-500">Change the description to make it easier to go back to a workspace.</p>
                    <p className="text-gray-500">Workspace URLs and endpoints will remain the same.</p>
                </div>
            </ModalBody>
            <ModalFooter>
                <Button type="secondary" disabled={updateDescription.isLoading} onClick={onClose}>
                    Cancel
                </Button>
                <Button htmlType="submit" loading={updateDescription.isLoading}>
                    Update Description
                </Button>
            </ModalFooter>
        </Modal>
    );
};
