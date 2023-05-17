/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { OIDCClientConfig } from "@gitpod/public-api/lib/gitpod/experimental/v1/oidc_pb";
import { FC, useCallback, useMemo, useState } from "react";
import ConfirmationModal from "../../components/ConfirmationModal";
import { ContextMenuEntry } from "../../components/ContextMenu";
import { Item, ItemField, ItemFieldContextMenu, ItemFieldIcon } from "../../components/ItemsList";
import { useDeleteOIDCClientMutation } from "../../data/oidc-clients/delete-oidc-client-mutation";
import { OIDCClientConfigModal } from "./OIDCClientConfigModal";
import { useToast } from "../../components/toasts/Toasts";
import { ModalFooterAlert } from "../../components/Modal";
import Tooltip from "../../components/Tooltip";
import { openOIDCStartWindow } from "../../provider-utils";
import { useInvalidateOIDCClientsQuery } from "../../data/oidc-clients/oidc-clients-query";
import { useActivateOIDCClientMutation } from "../../data/oidc-clients/activate-oidc-client-mutation";

type Props = {
    clientConfig: OIDCClientConfig;
    hasActiveConfig?: boolean;
};
export const OIDCClientListItem: FC<Props> = ({ clientConfig, hasActiveConfig = false }) => {
    const { toast } = useToast();
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
    const [showActivateModal, setShowActivateModal] = useState(false);
    const deleteOIDCClient = useDeleteOIDCClientMutation();
    const activateClient = useActivateOIDCClientMutation();
    const invalidateClients = useInvalidateOIDCClientsQuery();

    const handleVerifyClient = useCallback(async () => {
        await openOIDCStartWindow({
            verify: true,
            configId: clientConfig.id,
            onSuccess: async () => {
                invalidateClients();
                toast("Your SSO configuration was verified. You may now activate it.");
            },
            onError: (payload) => {
                let errorMessage: string;
                if (typeof payload === "string") {
                    errorMessage = payload;
                } else {
                    errorMessage = payload.description ? payload.description : `Error: ${payload.error}`;
                }
                toast(errorMessage);
            },
        });
    }, [clientConfig.id, invalidateClients, toast]);

    const menuEntries = useMemo(() => {
        const result: ContextMenuEntry[] = [
            {
                title: "Edit",
                onClick: () => setShowEditModal(true),
                separator: true,
            },
            ...(!clientConfig.verified
                ? [
                      {
                          title: "Verify",
                          onClick: handleVerifyClient,
                          separator: true,
                      },
                  ]
                : []),
            ...(!clientConfig.active && clientConfig.verified
                ? [
                      {
                          title: "Activate",
                          onClick: () => {
                              setShowActivateModal(true);
                          },
                          separator: true,
                      },
                  ]
                : []),
            {
                title: "Remove",
                customFontStyle: "text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300",
                onClick: () => setShowDeleteConfirmation(true),
            },
        ];
        return result;
    }, [clientConfig.active, clientConfig.verified, handleVerifyClient]);

    const deleteClient = useCallback(async () => {
        try {
            await deleteOIDCClient.mutateAsync({ clientId: clientConfig.id });
            setShowDeleteConfirmation(false);
            toast("The SSO configuration was deleted");
        } catch (error) {
            console.log(error);
        }
    }, [clientConfig.id, deleteOIDCClient, toast]);

    const handleActivateClient = useCallback(async () => {
        activateClient.mutate(
            { id: clientConfig.id },
            {
                onSuccess: () => {
                    setShowActivateModal(false);
                    toast("Your SSO configuration was activated");
                },
                onError: (error) => {
                    console.error(error);
                },
            },
        );
    }, [activateClient, clientConfig.id, toast]);

    return (
        <>
            <Item>
                <ItemFieldIcon>
                    <Tooltip content={clientConfig.active ? "Active" : clientConfig.verified ? "Verified" : "Inactive"}>
                        <div
                            className={
                                "rounded-full w-3 h-3 text-sm align-middle m-auto " +
                                (clientConfig.active
                                    ? "bg-green-500"
                                    : clientConfig.verified
                                    ? "bg-gitpod-kumquat"
                                    : "bg-gray-400")
                            }
                        >
                            &nbsp;
                        </div>
                    </Tooltip>
                </ItemFieldIcon>
                <ItemField className="flex flex-col flex-grow">
                    <span className="font-medium truncate overflow-ellipsis">{clientConfig.oidcConfig?.issuer}</span>
                    <span className="text-sm text-gray-500 break-all">{clientConfig.oauth2Config?.clientId}</span>
                </ItemField>
                <ItemFieldContextMenu menuEntries={menuEntries} />
            </Item>
            {showDeleteConfirmation && (
                <ConfirmationModal
                    title="Remove SSO configuration"
                    areYouSureText="Are you sure you want to remove the following SSO configuration?"
                    children={{
                        name: clientConfig.oidcConfig?.issuer ?? "",
                        description: clientConfig.oauth2Config?.clientId ?? "",
                    }}
                    buttonText="Remove"
                    buttonLoading={deleteOIDCClient.isLoading}
                    warningText={
                        clientConfig.active
                            ? "Warning, you are about to remove the active SSO configuration. If you continue, SSO will be disabled for your organization and no one, including yourself, will be able to log in."
                            : ""
                    }
                    footerAlert={
                        deleteOIDCClient.isError ? (
                            <ModalFooterAlert type="danger">
                                There was a problem deleting the configuration
                            </ModalFooterAlert>
                        ) : null
                    }
                    onClose={() => setShowDeleteConfirmation(false)}
                    onConfirm={deleteClient}
                />
            )}
            {showEditModal && (
                <OIDCClientConfigModal clientConfig={clientConfig} onClose={() => setShowEditModal(false)} />
            )}
            {showActivateModal && (
                <ConfirmationModal
                    title="Activate SSO configuration"
                    areYouSureText="Are you sure you want to activate the following SSO configuration?"
                    children={{
                        name: clientConfig.oidcConfig?.issuer ?? "",
                        description: clientConfig.oauth2Config?.clientId ?? "",
                    }}
                    buttonText="Activate"
                    buttonType="primary"
                    buttonLoading={activateClient.isLoading}
                    warningText={
                        hasActiveConfig
                            ? "Activating this SSO configuration will also deactivate the currently active configuration."
                            : ""
                    }
                    footerAlert={
                        activateClient.isError ? (
                            <ModalFooterAlert type="danger">
                                There was a problem activating the configuration
                            </ModalFooterAlert>
                        ) : null
                    }
                    onClose={() => setShowActivateModal(false)}
                    onConfirm={handleActivateClient}
                />
            )}
        </>
    );
};
