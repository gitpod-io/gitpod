/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import ContextMenu, { ContextMenuEntry } from "./ContextMenu";

export function ItemsList(props: { children?: React.ReactNode; className?: string }) {
    return <div className={`flex flex-col space-y-2 ${props.className || ""}`}>{props.children}</div>;
}

export function Item(props: { children?: React.ReactNode; className?: string; header?: boolean; solid?: boolean }) {
    // cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700
    const solidClassName = props.solid ? "bg-gray-50 dark:bg-gray-800" : "hover:bg-gray-100 dark:hover:bg-gray-800";
    const headerClassName = "text-sm text-gray-400 border-t border-b border-gray-200 dark:border-gray-800";
    const notHeaderClassName = "rounded-xl focus:bg-gitpod-kumquat-light " + solidClassName;
    return (
        <div
            className={`flex flex-grow flex-row w-full p-3 justify-between transition ease-in-out ${
                props.header ? headerClassName : notHeaderClassName
            } ${props.className || ""}`}
        >
            {props.children}
        </div>
    );
}

export function ItemField(props: { children?: React.ReactNode; className?: string }) {
    return <div className={`flex-grow mx-1 ${props.className || ""}`}>{props.children}</div>;
}

export function ItemFieldIcon(props: { children?: React.ReactNode; className?: string }) {
    return <div className={`flex self-center w-8 ${props.className || ""}`}>{props.children}</div>;
}

export function ItemFieldContextMenu(props: {
    menuEntries: ContextMenuEntry[];
    className?: string;
    position?: "start" | "center" | "end";
}) {
    const cls = "self-" + (props.position ?? "center");
    return (
        <div
            className={`flex hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md cursor-pointer w-8 ${cls} ${
                props.className || ""
            }`}
        >
            <ContextMenu menuEntries={props.menuEntries} />
        </div>
    );
}
