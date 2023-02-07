/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { UserEnvVarValue } from "@gitpod/gitpod-protocol";
import { Item, ItemField, ItemFieldContextMenu } from "../components/ItemsList";
import { useState } from "react";

export const EnvironmentVariableEntry = (props: {
    variable: UserEnvVarValue;
    edit: (varible: UserEnvVarValue) => void;
    confirmDeleteVariable: (varible: UserEnvVarValue) => void;
}) => {
    const [menuActive, setMenuActive] = useState(false);

    const changeMenuState = (state: boolean) => {
        setMenuActive(state);
    };

    return (
        <Item className="whitespace-nowrap" solid={menuActive}>
            <ItemField className="w-5/12 overflow-ellipsis truncate my-auto">{props.variable.name}</ItemField>
            <ItemField className="w-5/12 overflow-ellipsis truncate text-sm text-gray-400 my-auto">
                {props.variable.repositoryPattern}
            </ItemField>
            <ItemFieldContextMenu
                changeMenuState={changeMenuState}
                menuEntries={[
                    {
                        title: "Edit",
                        onClick: () => props.edit(props.variable),
                        separator: true,
                    },
                    {
                        title: "Delete",
                        customFontStyle: "text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300",
                        onClick: () => props.confirmDeleteVariable(props.variable),
                    },
                ]}
            />
        </Item>
    );
};
