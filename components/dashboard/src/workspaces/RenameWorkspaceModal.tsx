/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Workspace } from "@gitpod/gitpod-protocol";
import { FunctionComponent, useCallback, useState } from "react";
import Modal, { ModalBody, ModalFooter, ModalHeader } from "../components/Modal";
import { useUpdateWorkspaceDescriptionMutation } from "../data/workspaces/mutations";

type Props = {
    workspace: Workspace;
    onClose(): void;
};
export const RenameWorkspaceModal: FunctionComponent<Props> = ({ workspace, onClose }) => {
    const [errorMessage, setErrorMessage] = useState("");
    const [description, setDescription] = useState(workspace.description || "");
    const updateDescription = useUpdateWorkspaceDescriptionMutation();

    const updateWorkspaceDescription = useCallback(async () => {
        try {
            if (description.length === 0) {
                setErrorMessage("Description cannot not be empty.");
                return false;
            }

            if (description.length > 250) {
                setErrorMessage("Description is too long for readability.");
                return false;
            }

            setErrorMessage("");

            // Using mutateAsync here so we can close the modal after it completes successfully
            await updateDescription.mutateAsync({ workspaceId: workspace.id, newDescription: description });

            onClose();
        } catch (error) {
            console.error(error);
            setErrorMessage("Something went wrong. Please try renaming again.");
        }
    }, [description, updateDescription, workspace.id, onClose]);

    return (
        <Modal
            visible
            onClose={onClose}
            onEnter={async () => {
                await updateWorkspaceDescription();
                return true;
            }}
        >
            <ModalHeader>Rename Workspace Description</ModalHeader>
            <ModalBody>
                {errorMessage.length > 0 ? (
                    <div className="bg-gitpod-kumquat-light rounded-md p-3 text-gitpod-red text-sm mb-2">
                        {errorMessage}
                    </div>
                ) : null}
                <input
                    autoFocus
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
                <button disabled={updateDescription.isLoading} className="secondary" onClick={onClose}>
                    Cancel
                </button>
                <button
                    disabled={updateDescription.isLoading}
                    className="ml-2"
                    type="submit"
                    onClick={updateWorkspaceDescription}
                >
                    Update Description
                </button>
            </ModalFooter>
        </Modal>
    );
};
