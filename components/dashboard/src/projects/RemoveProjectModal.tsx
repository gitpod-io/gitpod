/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FunctionComponent, useCallback, useState } from "react";
import type { Project } from "@gitpod/gitpod-protocol";
import { projectsService } from "../service/public-api";
import { getGitpodService } from "../service/service";
import ConfirmationModal from "../components/ConfirmationModal";
import { useFeatureFlags } from "../contexts/FeatureFlagContext";

type RemoveProjectModalProps = {
    project: Project;
    onClose: () => void;
    onRemoved: () => void;
};

export const RemoveProjectModal: FunctionComponent<RemoveProjectModalProps> = ({ project, onClose, onRemoved }) => {
    const { usePublicApiProjectsService } = useFeatureFlags();
    const [disabled, setDisabled] = useState(false);

    const removeProject = useCallback(async () => {
        setDisabled(true);
        usePublicApiProjectsService
            ? await projectsService.deleteProject({ projectId: project.id })
            : await getGitpodService().server.deleteProject(project.id);
        setDisabled(false);
        onRemoved();
    }, [onRemoved, project.id, usePublicApiProjectsService]);

    return (
        <ConfirmationModal
            title="Remove Project"
            areYouSureText="Are you sure you want to remove this project from this team? Team members will also lose access to this project."
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
