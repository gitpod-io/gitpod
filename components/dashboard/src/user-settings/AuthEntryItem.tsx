/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useState } from "react";
import { ContextMenuEntry } from "../components/ContextMenu";
import { Item, ItemFieldIcon, ItemField, ItemFieldContextMenu } from "../components/ItemsList";
import { AuthProviderDescription } from "@gitpod/public-api/lib/gitpod/v1/authprovider_pb";
import { toAuthProviderLabel } from "../provider-utils";
import { getScopeNameForScope } from "@gitpod/public-api-common/lib/auth-providers";

interface AuthEntryItemParams {
    ap: AuthProviderDescription;
    isConnected: (authProviderId: string) => boolean;
    getUsername: (authProviderId: string) => string | undefined;
    getPermissions: (authProviderId: string) => string[] | undefined;
    gitProviderMenu: (provider: AuthProviderDescription) => ContextMenuEntry[];
}

export const AuthEntryItem = (props: AuthEntryItemParams) => {
    const [menuVisible, setMenuVisible] = useState<boolean>(false);

    const changeMenuState = (state: boolean) => {
        setMenuVisible(state);
    };

    return (
        <Item key={"ap-" + props.ap.id} className="h-16" solid={menuVisible}>
            <ItemFieldIcon>
                <div
                    className={
                        "rounded-full w-3 h-3 text-sm align-middle m-auto " +
                        (props.isConnected(props.ap.id) ? "bg-green-500" : "bg-gray-400")
                    }
                >
                    &nbsp;
                </div>
            </ItemFieldIcon>
            <ItemField className="w-4/12 xl:w-3/12 flex flex-col my-auto">
                <span className="my-auto font-medium truncate overflow-ellipsis">
                    {toAuthProviderLabel(props.ap.type)}
                </span>
                <span className="text-sm my-auto text-gray-400 truncate overflow-ellipsis dark:text-gray-500">
                    {props.ap.host}
                </span>
            </ItemField>
            <ItemField className="w-6/12 xl:w-3/12 flex flex-col my-auto">
                <span className="my-auto truncate text-gray-500 overflow-ellipsis dark:text-gray-400">
                    {props.getUsername(props.ap.id) || "–"}
                </span>
                <span className="text-sm my-auto text-gray-400 dark:text-gray-500">Username</span>
            </ItemField>
            <ItemField className="hidden xl:w-1/3 xl:flex xl:flex-col my-auto">
                <span className="my-auto truncate text-gray-500 overflow-ellipsis dark:text-gray-400">
                    {props.getPermissions(props.ap.id)?.map(getScopeNameForScope)?.join(", ") || "–"}
                </span>
                <span className="text-sm my-auto text-gray-400 dark:text-gray-500">Permissions</span>
            </ItemField>
            <ItemFieldContextMenu changeMenuState={changeMenuState} menuEntries={props.gitProviderMenu(props.ap)} />
        </Item>
    );
};
