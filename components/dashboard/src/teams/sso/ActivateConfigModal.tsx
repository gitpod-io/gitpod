/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, useCallback } from "react";
import ConfirmationModal from "../../components/ConfirmationModal";
import { useOIDCClientsQuery } from "../../data/oidc-clients/oidc-clients-query";
import { useActivateOIDCClientMutation } from "../../data/oidc-clients/activate-oidc-client-mutation";
import { useToast } from "../../components/toasts/Toasts";
import { ModalFooterAlert } from "../../components/Modal";

type Props = {
    configId: string;
    hasActiveConfig: boolean;
    onClose: () => void;
};
export const ActivateConfigModal: FC<Props> = ({ configId, hasActiveConfig, onClose }) => {
    const { toast } = useToast();
    const { data } = useOIDCClientsQuery();
    const config = (data || []).find((c) => c.id === configId);
    const activateClient = useActivateOIDCClientMutation();

    const handleActivateClient = useCallback(async () => {
        if (!config) {
            return;
        }

        try {
            await activateClient.mutateAsync({ id: config.id });

            toast("Single sign-on configuration was activated.");
            onClose();
        } catch (e) {}
    }, [activateClient, config, onClose, toast]);

    // We should already have the config in all the scenarios we show this modal. If we don't, wait for it.
    if (!config) {
        return null;
    }

    return (
        <ConfirmationModal
            title="Activate SSO configuration"
            areYouSureText="Are you sure you want to activate the following SSO configuration?"
            children={{
                name: config.oidcConfig?.issuer ?? "",
                description: config.oauth2Config?.clientId ?? "",
            }}
            buttonText="Activate"
            buttonType="default"
            warningText={
                hasActiveConfig
                    ? "Activating this SSO configuration will also deactivate the currently active configuration."
                    : ""
            }
            footerAlert={
                activateClient.isError ? (
                    <ModalFooterAlert type="danger">There was a problem activating the configuration</ModalFooterAlert>
                ) : null
            }
            onClose={onClose}
            onConfirm={handleActivateClient}
        />
    );
};
