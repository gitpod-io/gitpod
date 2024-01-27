/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useEffect, useState } from "react";
import Arrow from "./Arrow";
import ContextMenu from "./ContextMenu";

export interface DropDownProps {
    prefix?: string;
    customClasses?: string;
    renderAsLink?: boolean;
    activeEntry?: string;
    entries: DropDownEntry[];
}

export interface DropDownEntry {
    title: string;
    onClick: () => void;
}

function DropDown(props: DropDownProps) {
    const [current, setCurrent] = useState(props.activeEntry || props.entries[0].title);
    useEffect(() => {
        setCurrent(props.activeEntry || props.entries[0].title);
    }, [props.activeEntry, props.entries]);
    const enhancedEntries = props.entries.map((e) => {
        return {
            ...e,
            active: e.title === current,
            onClick: () => {
                e.onClick();
                setCurrent(e.title);
            },
        };
    });
    const defaultFont = "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 ";
    const asLinkFont = "text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-500";
    const asLinkArrowBorder =
        "border-blue-500 dark:border-blue-400 group-hover:border-blue-600 dark:group-hover:border-blue-500";
    return (
        <ContextMenu menuEntries={enhancedEntries} customClasses={`${props.customClasses} right-0`}>
            <span
                className={`py-2 cursor-pointer text-sm leading-1 group ${
                    props.renderAsLink ? asLinkFont : defaultFont
                } transition ease-in-out`}
            >
                {props.prefix}
                {current}
                <Arrow direction={"down"} customBorderClasses={props.renderAsLink ? asLinkArrowBorder : undefined} />
            </span>
        </ContextMenu>
    );
}

export default DropDown;
