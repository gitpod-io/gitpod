/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FunctionComponent, useCallback, useState } from "react";
import type { Project } from "@gitpod/gitpod-protocol";
import { projectsService } from "../service/public-api";
import ConfirmationModal from "../components/ConfirmationModal";

type RemoveProjectModalProps = {
    project: Project;
    onClose: () => void;
    onRemoved: () => void;
};

export const RemoveProjectModal: FunctionComponent<RemoveProjectModalProps> = ({ project, onClose, onRemoved }) => {
    const [disabled, setDisabled] = useState(false);

    const removeProject = useCallback(async () => {
        setDisabled(true);
        await projectsService.deleteProject({ projectId: project.id });
        setDisabled(false);
        onRemoved();
    }, [onRemoved, project.id]);

    return (
        <ConfirmationModal
            title="Remove Project"
            areYouSureText="Are you sure you want to remove this project from this organization? Organization members will also lose access to this project."
            children={{
                name: project?.name ?? "",
                description: project?.cloneUrl ?? "",
            }}
            buttonText="Remove Project"
            buttonDisabled={disabled}
            onClose={onClose}
            onConfirm={removeProject}
            visible
        />
    );
};
