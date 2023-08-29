/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { PersonalAccessToken } from "@gitpod/public-api/lib/gitpod/experimental/v1/tokens_pb";
import dayjs from "dayjs";
import { ContextMenuEntry } from "../components/ContextMenu";
import { ItemFieldContextMenu } from "../components/ItemsList";
import Tooltip from "../components/Tooltip";
import { ReactComponent as ExclamationIcon } from "../images/exclamation.svg";
import { AllPermissions } from "./PersonalAccessTokens";

interface TokenEntryProps {
    token: PersonalAccessToken;
    menuEntries: ContextMenuEntry[];
}

function TokenEntry(props: TokenEntryProps) {
    const expirationDay = dayjs(props.token.expirationTime!.toDate());
    const expired = expirationDay.isBefore(dayjs());
    const expirationDateString = expirationDay.format("MMM D, YYYY, hh:mm A");

    const getScopes = () => {
        if (!props.token.scopes) {
            return "";
        }
        const permissions = AllPermissions.filter((e) => e.scopes.every((v) => props.token.scopes.includes(v)));
        if (permissions.length > 0) {
            return permissions.map((e) => e.name).join("\n");
        } else {
            return "No access";
        }
    };

    return (
        <div className="rounded-xl whitespace-nowrap flex space-x-2 py-4 px-4 w-full justify-between hover:bg-gray-100 dark:hover:bg-gray-800 focus:bg-kumquat-light group">
            <div className="flex items-center pr-3 w-4/12">
                <span className="truncate">{props.token.name || ""}</span>
            </div>
            <div className="flex items-center w-4/12 text-gray-400 font-medium">
                <span className="truncate whitespace-pre-line">{getScopes()}</span>
            </div>
            <div className="flex items-center w-3/12 text-gray-400">
                <span className={"flex items-center gap-1 truncate" + (expired ? " text-orange-600" : "")}>
                    <span>{expirationDay.format("MMM D, YYYY")}</span>
                    {expired && (
                        <Tooltip content={expirationDateString}>
                            <ExclamationIcon fill="#D97706" className="h-4 w-4" />
                        </Tooltip>
                    )}
                </span>
            </div>
            <div className="flex items-center justify-end w-1/12">
                <ItemFieldContextMenu menuEntries={props.menuEntries} />
            </div>
        </div>
    );
}

export default TokenEntry;
