/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Workspace } from "@gitpod/gitpod-protocol";
import { FunctionComponent, useCallback } from "react";
import ConfirmationModal from "../components/ConfirmationModal";

type Props = {
    workspace: Workspace;
    onClose(): void;
};
export const DeleteWorkspaceModal: FunctionComponent<Props> = ({ workspace, onClose }) => {
    // TODO: Create a mutation for this
    const deleteWorkspace = useCallback(() => {
        console.log("delete workspace", workspace.id);

        // model.deleteWorkspace(ws.id, usePublicApiWorkspacesService);

        onClose();
    }, [onClose, workspace.id]);

    return (
        <ConfirmationModal
            title="Delete Workspace"
            areYouSureText="Are you sure you want to delete this workspace?"
            children={{
                name: workspace.id,
                description: workspace.description,
            }}
            buttonText="Delete Workspace"
            visible
            onClose={onClose}
            onConfirm={deleteWorkspace}
        />
    );
};
