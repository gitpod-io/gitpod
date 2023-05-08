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
import { gitpodHostUrl } from "../../service/service";
import { OIDCClientConfigModal } from "./OIDCClientConfigModal";

type Props = {
    clientConfig: OIDCClientConfig;
};
export const OIDCClientListItem: FC<Props> = ({ clientConfig }) => {
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
    const deleteOIDCClient = useDeleteOIDCClientMutation();

    const menuEntries = useMemo(() => {
        const result: ContextMenuEntry[] = [
            {
                title: "Edit",
                onClick: () => setShowEditModal(true),
                separator: true,
            },
            {
                title: "Login",
                onClick: () => {
                    window.location.href = gitpodHostUrl
                        .with({ pathname: `/iam/oidc/start`, search: `id=${clientConfig.id}` })
                        .toString();
                },
                separator: true,
            },
            ...(!clientConfig.active
                ? [
                      {
                          title: "Activate",
                          onClick: () => {
                              window.location.href = gitpodHostUrl
                                  .with({ pathname: `/iam/oidc/start`, search: `id=${clientConfig.id}&activate=true` })
                                  .toString();
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
    }, [clientConfig]);

    const deleteClient = useCallback(async () => {
        try {
            await deleteOIDCClient.mutateAsync({ clientId: clientConfig.id });
            setShowDeleteConfirmation(false);
        } catch (error) {
            console.log(error);
        }
    }, [clientConfig.id, deleteOIDCClient]);

    return (
        <>
            <Item key={clientConfig.id}>
                <ItemFieldIcon>
                    <div
                        className={
                            "rounded-full w-3 h-3 text-sm align-middle m-auto " +
                            (clientConfig.active ? "bg-green-500" : "bg-gray-400")
                        }
                    >
                        &nbsp;
                    </div>
                </ItemFieldIcon>
                <ItemField className="flex flex-col flex-grow">
                    <span className="font-medium truncate overflow-ellipsis">{clientConfig.oidcConfig?.issuer}</span>
                    <span className="text-sm text-gray-500 truncate overflow-ellipsis">{clientConfig.id}</span>
                </ItemField>
                <ItemFieldContextMenu menuEntries={menuEntries} />
            </Item>
            {showDeleteConfirmation && (
                <ConfirmationModal
                    title="Remove OIDC client"
                    areYouSureText="Are you sure you want to remove the following OIDC client?"
                    children={{
                        name: clientConfig.id,
                        description: clientConfig.oidcConfig?.issuer ?? "",
                    }}
                    buttonText="Remove client"
                    buttonDisabled={false}
                    warningText={deleteOIDCClient.isError ? "There was a problem deleting the client" : undefined}
                    onClose={() => setShowDeleteConfirmation(false)}
                    onConfirm={deleteClient}
                />
            )}
            {showEditModal && (
                <OIDCClientConfigModal clientConfig={clientConfig} onClose={() => setShowEditModal(false)} />
            )}
        </>
    );
};
