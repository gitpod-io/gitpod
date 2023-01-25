/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { AuthProviderEntry } from "@gitpod/gitpod-protocol";
import { FunctionComponent, useCallback, useMemo, useState } from "react";
import ConfirmationModal from "../../components/ConfirmationModal";
import { ContextMenuEntry } from "../../components/ContextMenu";
import { Item, ItemField, ItemFieldContextMenu, ItemFieldIcon } from "../../components/ItemsList";
import { useDeleteOrgAuthProviderMutation } from "../../data/auth-providers/delete-org-auth-provider-mutation";
import { GitIntegrationModal } from "./GitIntegrationModal";

type Props = {
    provider: AuthProviderEntry;
};
export const GitIntegrationListItem: FunctionComponent<Props> = ({ provider }) => {
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
    const deleteAuthProvider = useDeleteOrgAuthProviderMutation();

    const menuEntries = useMemo(() => {
        const result: ContextMenuEntry[] = [];
        result.push({
            title: provider.status === "verified" ? "Edit Configuration" : "Activate Integration",
            onClick: () => setShowEditModal(true),
            separator: true,
        });
        result.push({
            title: "Remove",
            customFontStyle: "text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300",
            onClick: () => setShowDeleteConfirmation(true),
        });
        return result;
    }, [provider.status]);

    const deleteProvider = useCallback(async () => {
        try {
            await deleteAuthProvider.mutateAsync({ providerId: provider.id });
            setShowDeleteConfirmation(false);
        } catch (error) {
            console.log(error);
        }
    }, [deleteAuthProvider, provider.id]);

    return (
        <>
            <Item className="h-16">
                <ItemFieldIcon>
                    <div
                        className={
                            "rounded-full w-3 h-3 text-sm align-middle m-auto " +
                            (provider.status === "verified" ? "bg-green-500" : "bg-gray-400")
                        }
                    >
                        &nbsp;
                    </div>
                </ItemFieldIcon>
                <ItemField className="w-3/12 flex flex-col my-auto">
                    <span className="font-medium truncate overflow-ellipsis">{provider.type}</span>
                </ItemField>
                <ItemField className="w-7/12 flex flex-col my-auto">
                    <span className="my-auto truncate text-gray-500 overflow-ellipsis">{provider.host}</span>
                </ItemField>
                <ItemFieldContextMenu menuEntries={menuEntries} />
            </Item>
            {showDeleteConfirmation && (
                <ConfirmationModal
                    title="Remove Integration"
                    areYouSureText="Are you sure you want to remove the following Git integration?"
                    children={{
                        name: provider.type,
                        description: provider.host,
                    }}
                    buttonText="Remove Integration"
                    buttonDisabled={deleteAuthProvider.isLoading}
                    warningText={deleteAuthProvider.isError ? "There was a problem deleting the provider" : undefined}
                    onClose={() => setShowDeleteConfirmation(false)}
                    onConfirm={deleteProvider}
                />
            )}
            {showEditModal && <GitIntegrationModal provider={provider} onClose={() => setShowEditModal(false)} />}
        </>
    );
};
