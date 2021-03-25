/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { useState } from "react";
import Modal from "../components/Modal";

export interface WsStartEntry {
    title: string
    description: string
    startUrl: string
}

interface StartWorkspaceModalProps {
    visible: boolean;
    recent: WsStartEntry[];
    examples: WsStartEntry[];
    selected?: Mode;
    onClose: () => void;
}

type Mode = 'Recent' | 'Examples';

function Tab(p: { name: Mode, selection: Mode, setSelection: (selection: Mode) => any }) {
    const selectedTab = 'border-gray-800 text-gray-800';
    const inactiveTab = 'border-none text-gray-400';
    return <div onClick={() => p.setSelection(p.name)} className={"cursor-pointer py-2 px-4 border-b-4 " + (p.selection === p.name ? selectedTab : inactiveTab)}>{p.name}</div>
}

export function StartWorkspaceModal(p: StartWorkspaceModalProps) {
    const [selection, setSelection] = useState(p.selected || 'Recent');

    const list = (selection === 'Recent' ? p.recent : p.examples).map(e =>
        <a key={e.title} href={e.startUrl} className="rounded-xl group hover:bg-gray-100 flex p-4 my-1">
            <div className="w-full">
                <p className="text-base text-gray-800 font-semibold">{e.title}</p>
                <p>{e.description}</p>
            </div>
        </a>);

    return <Modal onClose={p.onClose} visible={p.visible}>
        <h3 className="pb-2">New Workspace</h3>
        {/* separator */}
        <div className="border-t mt-2 -mx-6 px-6 pt-2">
            <div className="flex">
                <Tab name='Recent' setSelection={setSelection} selection={selection} />
                <Tab name='Examples' setSelection={setSelection} selection={selection} />
            </div>
        </div>
        <div className="border-t -mx-6 px-6 py-2">
            {list.length > 0 ?
                <p className="my-4 text-base">
                    {selection === 'Recent' ?
                        'Create a new workspace using the default branch.' :
                        'Create a new workspace using an example project.'}
                </p> : <p className="h-6 my-4"></p>}
            <div className="space-y-2 mt-4 overflow-y-scroll h-80 pr-2">
                {list.length > 0 ? list :
                    (selection === 'Recent' ?
                        <div className="flex flex-col pt-12 items-center px-2">
                            <h3 className="mb-2 text-gray-500">No Recent Projects</h3>
                            <p className="text-center">Projects you use frequently will show up here.</p>
                            <p className="text-center">Prefix a git repository URL with gitpod.io/# or start with an example.</p>
                            <button onClick={() => setSelection('Examples')} className="font-medium mt-8">Select Example</button>
                        </div> :
                        <div className="flex flex-col pt-10 items-center px-2">
                            <h3 className="mb-2">No Example Projects</h3>
                            <p className="text-center">Sorry there seem to be no example projects, that work with your current git provider.</p>
                        </div>)
                }
            </div>
        </div>
    </Modal>;
}