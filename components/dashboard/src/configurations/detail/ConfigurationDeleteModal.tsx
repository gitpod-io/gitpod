/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import type { Project } from "@gitpod/gitpod-protocol";
import { FunctionComponent, useCallback } from "react";
import ConfirmationModal from "../../components/ConfirmationModal";
import { useDeleteProject } from "../../data/projects/project-queries";

type RemoveConfigurationModalProps = {
    configuration: Project;
    onClose: () => void;
    onRemoved: () => void;
};

export const RemoveConfigurationModal: FunctionComponent<RemoveConfigurationModalProps> = ({
    configuration,
    onClose,
    onRemoved,
}) => {
    const useDeleteRepository = useDeleteProject();

    const removeConfiguration = useCallback(async () => {
        await useDeleteRepository.mutateAsync(configuration.id);
        onRemoved();
    }, [onRemoved, configuration.id, useDeleteRepository]);

    return (
        <ConfirmationModal
            title="Remove Configuration"
            areYouSureText="Are you sure you want to remove this repository configuration from this organization? Organization members will also lose access to it."
            children={{
                name: configuration.name ?? "",
                description: configuration.cloneUrl ?? "",
            }}
            buttonText="Remove Configuration"
            buttonDisabled={useDeleteRepository.isLoading}
            onClose={onClose}
            onConfirm={removeConfiguration}
            visible
        />
    );
};
