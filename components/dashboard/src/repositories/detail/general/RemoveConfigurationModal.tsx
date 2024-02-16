/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FunctionComponent, useCallback } from "react";
import ConfirmationModal from "../../../components/ConfirmationModal";
import type { Configuration } from "@gitpod/public-api/lib/gitpod/v1/configuration_pb";
import { useDeleteConfiguration } from "../../../data/configurations/configuration-queries";

type Props = {
    configuration: Configuration;
    onClose: () => void;
    onRemoved: () => void;
};
export const RemoveConfigurationModal: FunctionComponent<Props> = ({ configuration, onClose, onRemoved }) => {
    const removeConfigMutation = useDeleteConfiguration();

    const removeProject = useCallback(async () => {
        removeConfigMutation.mutate(
            { configurationId: configuration.id },
            {
                onSuccess: () => onRemoved(),
            },
        );
    }, [removeConfigMutation, configuration.id, onRemoved]);

    return (
        <ConfirmationModal
            title="Remove Configuration"
            areYouSureText="Are you sure you want to remove this repository configuration from this organization? Organization members will also lose access to it."
            children={{
                name: configuration.name ?? "",
                description: configuration.cloneUrl ?? "",
            }}
            buttonText="Remove Configuration"
            buttonDisabled={removeConfigMutation.isLoading}
            onClose={onClose}
            onConfirm={removeProject}
            visible
        />
    );
};
