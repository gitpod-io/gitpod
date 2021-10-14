/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { useEffect, useState } from 'react';
import ContextMenu from './ContextMenu';

export interface DropDownProps {
    prefix?: string;
    contextMenuWidth?: string;
    activeEntry?: string,
    entries: DropDownEntry[];
}

export interface DropDownEntry {
    title: string,
    onClick: ()=>void
}

function Arrow(props: {up: boolean}) {
    return <span className="mx-2 border-gray-400 dark:border-gray-600 group-hover:border-gray-600 dark:group-hover:border-gray-400" style={{ marginTop: 2, marginBottom: 2, padding: 3, borderWidth: '0 2px 2px 0', display: 'inline-block', transform: `rotate(${props.up ? '-135deg' : '45deg'})`}}></span>
}

function DropDown(props: DropDownProps) {
    const [current, setCurrent] = useState(props.activeEntry || props.entries[0].title);
    useEffect(() => {
        setCurrent(props.activeEntry || props.entries[0].title);
    }, [props.activeEntry, props.entries]);
    const enhancedEntries = props.entries.map(e => {
        return {
            ...e,
            active: e.title === current,
            onClick: () => {
                e.onClick();
                setCurrent(e.title);
            }
        }
    })
    const font = "text-gray-400 dark:text-gray-500 text-sm leading-1 group hover:text-gray-600 dark:hover:text-gray-400 transition ease-in-out"
    return (
        <ContextMenu menuEntries={enhancedEntries} classes={`${props.contextMenuWidth} right-0`}>
            <span className={`py-2 cursor-pointer ${font}`}>{props.prefix}{current}<Arrow up={false}/></span>
        </ContextMenu>
    );
}

export default DropDown;