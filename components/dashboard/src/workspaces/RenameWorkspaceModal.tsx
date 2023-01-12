/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Workspace } from "@gitpod/gitpod-protocol";
import { FunctionComponent, useCallback, useState } from "react";
import Modal from "../components/Modal";
import { useUpdateWorkspaceDescription } from "../data/workspaces/mutations";

type Props = {
    workspace: Workspace;
    onClose(): void;
};
export const RenameWorkspaceModal: FunctionComponent<Props> = ({ workspace, onClose }) => {
    const [description, setDescription] = useState(workspace.description || "");
    const [errorMessage, setErrorMessage] = useState("");
    const { mutateAsync, isLoading } = useUpdateWorkspaceDescription();

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

            await mutateAsync({ workspaceId: workspace.id, newDescription: description });
            console.log("after mutateAsync");
            onClose();
        } catch (error) {
            console.error(error);
            setErrorMessage("Something went wrong. Please try renaming again.");
        }
    }, [description, mutateAsync, onClose, workspace.id]);

    return (
        <Modal
            visible
            onClose={onClose}
            onEnter={async () => {
                await updateWorkspaceDescription();
                return true;
            }}
        >
            <h3 className="mb-4">Rename Workspace Description</h3>
            <div className="border-t border-b border-gray-200 dark:border-gray-800 -mx-6 px-6 py-4 space-y-2">
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
                    disabled={isLoading}
                    onChange={(e) => setDescription(e.target.value)}
                />
                <div className="mt-1">
                    <p className="text-gray-500">Change the description to make it easier to go back to a workspace.</p>
                    <p className="text-gray-500">Workspace URLs and endpoints will remain the same.</p>
                </div>
            </div>
            <div className="flex justify-end mt-6">
                <button disabled={isLoading} className="secondary" onClick={onClose}>
                    Cancel
                </button>
                <button disabled={isLoading} className="ml-2" type="submit" onClick={updateWorkspaceDescription}>
                    Update Description
                </button>
            </div>
        </Modal>
    );
};
