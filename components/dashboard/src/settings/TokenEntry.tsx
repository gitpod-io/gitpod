/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { PersonalAccessToken } from "@gitpod/public-api/lib/gitpod/experimental/v1/tokens_pb";
import { ContextMenuEntry } from "../components/ContextMenu";
import { ItemFieldContextMenu } from "../components/ItemsList";

const menuEntries: ContextMenuEntry[] = [
    {
        title: "Edit",
        href: "",
        onClick: () => {},
    },
    {
        title: "Regenerate",
        href: "",
        onClick: () => {},
    },
    {
        title: "Delete",
        href: "",
        onClick: () => {},
    },
];

function TokenEntry(t: { token: PersonalAccessToken }) {
    if (!t) {
        return <></>;
    }

    const getDate = () => {
        if (!t.token.expirationTime) {
            return "";
        }
        const date = t.token.expirationTime?.toDate();
        return date.toDateString();
    };

    const defaultAllScope = ["function:*", "resource:default"];

    const getScopes = () => {
        if (!t.token.scopes) {
            return "";
        }
        if (t.token.scopes.every((v) => defaultAllScope.includes(v))) {
            return "Access the user's API";
        } else {
            return "No access";
        }
    };

    return (
        <>
            <div className="rounded-xl whitespace-nowrap flex space-x-2 py-4 px-4 w-full justify-between hover:bg-gray-100 dark:hover:bg-gray-800 focus:bg-gitpod-kumquat-light group">
                <div className="pr-3 self-center w-3/12">
                    <span>{t.token.name || ""}</span>
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
        </>
    );
}

export default TokenEntry;
