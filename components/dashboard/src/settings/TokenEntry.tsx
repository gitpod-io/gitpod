/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { PersonalAccessToken } from "@gitpod/public-api/lib/gitpod/experimental/v1/tokens_pb";
import { useState } from "react";
import { ContextMenuEntry } from "../components/ContextMenu";
import { ItemFieldContextMenu } from "../components/ItemsList";
import { personalAccessTokensService } from "../service/public-api";
import { ShowTokenModal } from "./PersonalAccessTokens";
import { settingsPathPersonalAccessTokenEdit } from "./settings.routes";

function TokenEntry(props: { token: PersonalAccessToken; onDelete: (tokenId: string) => void }) {
    const [showDelModal, setShowDelModal] = useState<boolean>(false);

    const menuEntries: ContextMenuEntry[] = [
        {
            title: "Edit",
            link: `${settingsPathPersonalAccessTokenEdit}/${props.token.id}`,
        },
        {
            title: "Delete",
            href: "",
            customFontStyle: "text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300",
            onClick: () => {
                setShowDelModal(true);
            },
        },
    ];

    const doDeletePAT = async () => {
        try {
            await personalAccessTokensService.deletePersonalAccessToken({ id: props.token.id });
            setShowDelModal(false);
            props.onDelete(props.token.id);
        } catch (e) {
            // TODO: show error
        }
    };

    const getDate = () => {
        if (!props.token.expirationTime) {
            return "";
        }
        const date = props.token.expirationTime?.toDate();
        return date.toDateString();
    };

    const defaultAllScope = ["function:*", "resource:default"];

    const getScopes = () => {
        if (!props.token.scopes) {
            return "";
        }
        if (props.token.scopes.every((v) => defaultAllScope.includes(v))) {
            return "Access the user's API";
        } else {
            return "No access";
        }
    };

    return (
        <>
            <div className="rounded-xl whitespace-nowrap flex space-x-2 py-4 px-4 w-full justify-between hover:bg-gray-100 dark:hover:bg-gray-800 focus:bg-gitpod-kumquat-light group">
                <div className="pr-3 self-center w-3/12">
                    <span>{props.token.name || ""}</span>
                </div>
                <div className="flex flex-col w-3/12 text-gray-400 font-medium">
                    <span>{getScopes()}</span>
                </div>
                <div className="flex flex-col w-3/12 text-gray-400">
                    <span>{getDate()}</span>
                </div>
                <div className="flex flex-col w-3/12">
                    <ItemFieldContextMenu menuEntries={menuEntries} />
                </div>
            </div>
            {showDelModal && (
                <ShowTokenModal
                    token={props.token}
                    title="Delete Personal Access Token"
                    description="Are you sure you want to delete this personal access token?"
                    descriptionImportant="Any applications using this token will no longer be able to access the Gitpod API."
                    actionDescription="Delete Personal Access Token"
                    onSave={doDeletePAT}
                    onClose={() => {
                        setShowDelModal(false);
                    }}
                />
            )}
        </>
    );
}

export default TokenEntry;
