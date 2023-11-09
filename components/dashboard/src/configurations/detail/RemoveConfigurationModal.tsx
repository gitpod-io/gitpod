/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FunctionComponent, useCallback, useState } from "react";
import ConfirmationModal from "../../components/ConfirmationModal";
import { useDeleteConfiguration } from "../../data/configurations/delete-configuration-mutation";
import type { Configuration } from "@gitpod/public-api/lib/gitpod/v1/configuration_pb";

type RemoveProjectModalProps = {
    configuration: Configuration;
    onClose: () => void;
    onRemoved: () => void;
};

export const RemoveConfigurationModal: FunctionComponent<RemoveProjectModalProps> = ({
    configuration,
    onClose,
    onRemoved,
}) => {
    const [disabled, setDisabled] = useState(false);
    const removeConfigMutation = useDeleteConfiguration(configuration.id);

    const removeProject = useCallback(async () => {
        setDisabled(true);
        removeConfigMutation.mutateAsync();
        setDisabled(false);
        onRemoved();
    }, [removeConfigMutation, onRemoved]);

    return (
        <ConfirmationModal
            title="Remove Repository"
            areYouSureText="Are you sure you want to remove this repository from this organization? Organization members will also lose access to it.."
            children={{
                name: configuration?.name ?? "",
                description: configuration?.cloneUrl ?? "",
            }}
            buttonText="Remove Repository"
            buttonDisabled={disabled}
            onClose={onClose}
            onConfirm={removeProject}
            visible
        />
    );
};
