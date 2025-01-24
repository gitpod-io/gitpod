/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import React, { FunctionComponent, HTMLAttributeAnchorTarget } from "react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import cn from "classnames";

export interface ContextMenuProps {
    children?: React.ReactChild[] | React.ReactChild;
    menuEntries: ContextMenuEntry[];
    changeMenuState?: (state: boolean) => void;
    customClasses?: string;
}

export interface ContextMenuEntry {
    title: string;
    active?: boolean;
    /**
     * whether a separator line should be rendered below this item
     */
    separator?: boolean;
    customFontStyle?: string;
    customContent?: React.ReactChild;
    onClick?: (event: React.MouseEvent) => void;
    href?: string;
    link?: string;
    target?: HTMLAttributeAnchorTarget;
    download?: string;
    rel?: string;
}

function ContextMenu(props: ContextMenuProps) {
    const [expanded, setExpanded] = useState(false);

    const toggleExpanded = () => {
        setExpanded(!expanded);
        if (props.changeMenuState) {
            props.changeMenuState(!expanded);
        }
    };

    const keydownHandler = (evt: KeyboardEvent) => {
        if (evt.key === "Escape") {
            setExpanded(false);
        }
    };

    const skipClickHandlerRef = React.useRef(false);
    const setSkipClickHandler = (data: boolean) => {
        skipClickHandlerRef.current = data;
    };
    const clickHandler = (evt: MouseEvent) => {
        if (skipClickHandlerRef.current) {
            // skip only once
            setSkipClickHandler(false);
        } else {
            setExpanded(false);
        }
    };

    useEffect(() => {
        window.addEventListener("keydown", keydownHandler);
        window.addEventListener("click", clickHandler);
        // Remove event listeners on cleanup
        return () => {
            window.removeEventListener("keydown", keydownHandler);
            window.removeEventListener("click", clickHandler);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Empty array ensures that effect is only run on mount and unmount

    // Default 'children' is the three dots hamburger button.
    const children = props.children || (
        <svg
            className={cn(
                "w-8 h-8 p-1 rounded-md text-gray-600 dark:text-gray-300",
                expanded ? "bg-gray-200 dark:bg-gray-700" : "hover:bg-gray-200 dark:hover:bg-gray-700",
            )}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
        >
            <title>Actions</title>
            <g fill="currentColor" transform="rotate(90 12 12)">
                <circle cx="1" cy="1" r="2" transform="translate(5 11)" />
                <circle cx="1" cy="1" r="2" transform="translate(11 11)" />
                <circle cx="1" cy="1" r="2" transform="translate(17 11)" />
            </g>
        </svg>
    );

    return (
        <div className="relative">
            <div
                className="cursor-pointer"
                onClick={(e) => {
                    toggleExpanded();
                    // Don't use `e.stopPropagation();` because that prevents that clicks on other context menus closes this one.
                    setSkipClickHandler(true);
                }}
            >
                {children}
            </div>
            {expanded ? (
                <div
                    className={`mt-2 z-50 bg-white dark:bg-gray-900 absolute flex flex-col border border-gray-200 dark:border-gray-800 filter drop-shadow-xl rounded-lg truncated ${
                        props.customClasses || "w-48 right-0"
                    }`}
                    data-analytics='{"button_type":"context_menu"}'
                >
                    {props.menuEntries.length === 0 ? (
                        <p className="px-4 py-3">No actions available</p>
                    ) : (
                        props.menuEntries.map((e, index) => {
                            const entry = (
                                <MenuEntry
                                    {...e}
                                    isFirst={index === 0}
                                    isLast={index === props.menuEntries.length - 1}
                                />
                            );
                            const key = `entry-${index}-${e.title}`;
                            if (e.link) {
                                return (
                                    <Link key={key} to={e.link} onClick={e.onClick} target={e.target}>
                                        {entry}
                                    </Link>
                                );
                            } else if (e.href) {
                                return (
                                    <a
                                        key={key}
                                        download={e.download}
                                        href={e.href}
                                        onClick={e.onClick}
                                        target={e.target}
                                    >
                                        {entry}
                                    </a>
                                );
                            } else {
                                return (
                                    <div key={key} onClick={e.onClick}>
                                        {entry}
                                    </div>
                                );
                            }
                        })
                    )}
                </div>
            ) : null}
        </div>
    );
}

export default ContextMenu;

type MenuEntryProps = ContextMenuEntry & {
    isFirst: boolean;
    isLast: boolean;
};
export const MenuEntry: FunctionComponent<MenuEntryProps> = ({
    title,
    href,
    link,
    active = false,
    separator = false,
    customContent,
    customFontStyle,
    isFirst,
    isLast,
    onClick,
}) => {
    const clickable = href || link || onClick;

    return (
        <div
            title={title}
            className={cn(
                "px-4 py-2 flex leading-1 text-sm",
                customFontStyle || "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-100",
                {
                    "cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700": clickable,
                    "bg-pk-surface-secondary": active,
                    "rounded-t-lg": isFirst,
                    "rounded-b-lg": isLast,
                    "border-b border-gray-200 dark:border-gray-800": separator,
                },
            )}
        >
            {customContent || (
                <>
                    <div className="truncate w-52">{title}</div>
                    <div className="flex-1"></div>
                    {active ? <div className="pl-1 font-semibold">&#x2713;</div> : null}
                </>
            )}
        </div>
    );
};
