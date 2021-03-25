/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { useEffect } from "react";

export default function Modal(props: {
    children: React.ReactChild[] | React.ReactChild,
    visible: boolean,
    closeable?: boolean,
    className?: string,
    onClose: () => void,
    onEnter?: () => boolean
}) {

    const handler = (evt: KeyboardEvent) => {
        if (evt.key === 'Escape') {
            props.onClose();
        }
        if (evt.key === 'Enter') {
            if (props.onEnter) {
                if (props.onEnter()) {
                    props.onClose();
                }
            } else {
                props.onClose();
            }
        }
    }
    // Add event listeners
    useEffect(() => {
        window.addEventListener('keydown', handler);
        // Remove event listeners on cleanup
        return () => {
            window.removeEventListener('keydown', handler);
        };
    }, []); // Empty array ensures that effect is only run on mount and unmount
        
    if (!props.visible) {
        return null;
    }
    
    return (
        <div className="fixed top-0 left-0 bg-black bg-opacity-70 z-50 w-screen h-screen" onClick={props.onClose}>
            <div className="w-screen h-screen align-middle" style={{display: 'table-cell'}}>
                <div className={"relative bg-white border rounded-xl p-6 max-w-lg mx-auto text-gray-600" + props.className} onClick={e => e.stopPropagation()}>
                    {props.closeable !== false && (
                        <div className="absolute right-7 top-6 cursor-pointer hover:bg-gray-200 rounded-md p-2" onClick={props.onClose}>
                            <svg version="1.1" width="14px" height="14px"
                                viewBox="0 0 100 100">
                                <line x1="0" y1="0" x2="100" y2="100" stroke="currentColor" strokeWidth="10px" />
                                <line x1="0" y1="100" x2="100" y2="0" stroke="currentColor" strokeWidth="10px" />
                            </svg>
                        </div>
                    )}
                    {props.children}
                </div>
            </div>
        </div>
    );
}