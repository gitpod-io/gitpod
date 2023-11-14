/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { ContextMenuEntry } from "../components/ContextMenu";
import { Item, ItemFieldIcon, ItemField, ItemFieldContextMenu } from "../components/ItemsList";
import { AuthProvider } from "@gitpod/public-api/lib/gitpod/v1/authprovider_pb";
import { toAuthProviderLabel } from "../provider-utils";

export const IntegrationEntryItem = (props: {
    ap: AuthProvider;
    gitProviderMenu: (provider: AuthProvider) => ContextMenuEntry[];
}) => {
    return (
        <Item key={"ap-" + props.ap.id} className="h-16">
            <ItemFieldIcon>
                <div
                    className={
                        "rounded-full w-3 h-3 text-sm align-middle m-auto " +
                        (props.ap.verified ? "bg-green-500" : "bg-gray-400")
                    }
                >
                    &nbsp;
                </div>
            </ItemFieldIcon>
            <ItemField className="w-3/12 flex flex-col my-auto">
                <span className="font-medium truncate overflow-ellipsis">{toAuthProviderLabel(props.ap.type)}</span>
            </ItemField>
            <ItemField className="w-7/12 flex flex-col my-auto">
                <span className="my-auto truncate text-gray-500 overflow-ellipsis">{props.ap.host}</span>
            </ItemField>
            <ItemFieldContextMenu menuEntries={props.gitProviderMenu(props.ap)} />
        </Item>
    );
};
