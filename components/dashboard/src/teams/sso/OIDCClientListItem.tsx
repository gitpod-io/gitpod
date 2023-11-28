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

type Props = {
    clientConfig: OIDCClientConfig;
    hasActiveConfig: boolean;
    onSaved: (configId: string) => void;
    onVerify: (configId: string) => void;
    onActivate: (configId: string) => void;
};
export const OIDCClientListItem: FC<Props> = ({ clientConfig, hasActiveConfig, onSaved, onVerify, onActivate }) => {
    const { toast } = useToast();
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
    const deleteOIDCClient = useDeleteOIDCClientMutation();

    const menuEntries = useMemo(() => {
        const result: ContextMenuEntry[] = [
            {
                title: clientConfig.active ? "View" : "Edit",
                onClick: () => setShowEditModal(true),
                separator: true,
            },
            ...(!clientConfig.verified
                ? [
                      {
                          title: "Verify",
                          onClick: () => onVerify(clientConfig.id),
                          separator: true,
                      },
                  ]
                : []),
            ...(!clientConfig.active && clientConfig.verified
                ? [
                      {
                          title: "Activate",
                          onClick: () => {
                              onActivate(clientConfig.id);
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
    }, [clientConfig.active, clientConfig.id, clientConfig.verified, onActivate, onVerify]);

    const deleteClient = useCallback(async () => {
        try {
            await deleteOIDCClient.mutateAsync({ clientId: clientConfig.id });
            setShowDeleteConfirmation(false);
            toast("The SSO configuration was deleted");
        } catch (error) {
            console.log(error);
        }
    }, [clientConfig.id, deleteOIDCClient, toast]);

    return (
        <>
            <Item>
                <ItemFieldIcon>
                    <Tooltip content={clientConfig.active ? "Active" : clientConfig.verified ? "Verified" : "Inactive"}>
                        <div
                            className={`rounded-full w-3 h-3 text-sm align-middle m-auto ${
                                clientConfig.active
                                    ? "bg-green-500"
                                    : clientConfig.verified
                                      ? "bg-kumquat-ripe"
                                      : "bg-gray-400"
                            }`}
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
                <OIDCClientConfigModal
                    clientConfig={clientConfig}
                    onSaved={onSaved}
                    onClose={() => setShowEditModal(false)}
                />
            )}
        </>
    );
};
