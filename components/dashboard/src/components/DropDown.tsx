/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useEffect, useState } from "react";
import Arrow from "./Arrow";
import ContextMenu from "./ContextMenu";
import { cn } from "@podkit/lib/cn";

export interface DropDownProps {
    prefix?: string;
    className?: string;
    renderAsLink?: boolean;
    activeEntry?: string;
    entries: DropDownEntry[];
}

export interface DropDownEntry {
    title: string;
    onClick: () => void;
}

function DropDown({ className, prefix, renderAsLink, entries, activeEntry }: DropDownProps) {
    const [current, setCurrent] = useState(activeEntry || entries[0].title);
    useEffect(() => {
        setCurrent(activeEntry || entries[0].title);
    }, [activeEntry, entries]);
    const enhancedEntries = entries.map((e) => {
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
        <ContextMenu menuEntries={enhancedEntries} customClasses={cn(`text-sm right-0`, className)}>
            <span
                className={`py-2 cursor-pointer leading-1 group ${
                    renderAsLink ? asLinkFont : defaultFont
                } transition ease-in-out`}
            >
                {prefix}
                {current}
                <Arrow direction={"down"} customBorderClasses={renderAsLink ? asLinkArrowBorder : undefined} />
            </span>
        </ContextMenu>
    );
}

export default DropDown;
