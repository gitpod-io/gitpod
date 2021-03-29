/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

export interface ContextMenuProps {
    children: React.ReactChild[] | React.ReactChild;
    menuEntries: ContextMenuEntry[];
    width?: string;
}

export interface ContextMenuEntry {
    title: string;
    active?: boolean;
    /**
     * whether a separator line should be rendered below this item
     */
    separator?: boolean;
    customFontStyle?: string;
    onClick?: (event: React.MouseEvent) => void;
    href?: string;
    link?: string;
}

function ContextMenu(props: ContextMenuProps) {
    const [expanded, setExpanded] = useState(false);
    const toggleExpanded = () => {
        setExpanded(!expanded);
    }

    const handler = (evt: KeyboardEvent) => {
        if (evt.key === 'Escape') {
            setExpanded(false);
        }
    }

    const clickHandler = (evt: MouseEvent) => {
        setExpanded(false);
    }

    useEffect(() => {
        window.addEventListener('keydown', handler);
        window.addEventListener('click', clickHandler);
        // Remove event listeners on cleanup
        return () => {
            window.removeEventListener('keydown', handler);
            window.removeEventListener('click', clickHandler);
        };
    }, []); // Empty array ensures that effect is only run on mount and unmount


    const font = "text-gray-600 hover:text-gray-800"

    const menuId = String(Math.random());

    return (
        <div className="relative cursor-pointer">
            <div onClick={(e) => {
                toggleExpanded();
                e.stopPropagation();
            }}>
                {props.children}
            </div>
            {expanded ?
                <div className={`mt-2 z-50 ${props.width || 'w-48'} bg-white absolute right-0 flex flex-col border border-gray-200 rounded-lg truncated`}>
                    {props.menuEntries.map((e, index) => {
                        const clickable = e.href || e.onClick || e.link;
                        const entry = <div className={`px-4 flex py-3 ${clickable ? 'hover:bg-gray-200' : ''} text-sm leading-1 ${e.customFontStyle || font} ${e.separator ? ' border-b border-gray-200' : ''}`} >
                            <div className="truncate w-52">{e.title}</div><div className="flex-1"></div>{e.active ? <div className="pl-1 font-semibold">&#x2713;</div> : null}
                        </div>
                        const key = `entry-${menuId}-${index}-${e.title}`;
                        if (e.link) {
                            return <Link key={key} to={e.link} onClick={e.onClick}>
                                {entry}
                            </Link>;
                        } else if (e.href) {
                            return <a key={key} href={e.href} onClick={e.onClick}>
                                {entry}
                            </a>;
                        } else {
                            return <div key={key} onClick={e.onClick}>
                                {entry}
                            </div>
                        }

                    })}
                </div>
                :
                null
            }
        </div>
    );
}

export default ContextMenu;