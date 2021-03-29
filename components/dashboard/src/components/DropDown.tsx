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
    entries: { 
        title: string,
        onClick: ()=>void
    }[];
}

function Arrow(props: {up: boolean}) {
    return <span className="mx-2 border-gray-400 group-hover:border-gray-600" style={{ margin: 2, padding: 3, border: 'solid black', borderWidth: '0 2px 2px 0', display: 'inline-block', transform: `rotate(${props.up ? '-135deg' : '45deg'})`}}></span>
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
    const font = "text-gray-400 text-sm leading-1 group hover:text-gray-600 transition ease-in-out"
    return (
        <ContextMenu menuEntries={enhancedEntries} width={props.contextMenuWidth}>
            <span className={`py-2 cursor-pointer ${font}`}>{props.prefix}{current}<Arrow up={false}/></span>
        </ContextMenu>
    );
}

export default DropDown;