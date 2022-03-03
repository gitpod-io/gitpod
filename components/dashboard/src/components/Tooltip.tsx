/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { useState } from 'react';

export interface TooltipProps {
    children: React.ReactChild[] | React.ReactChild;
    content: string;
    allowWrap?: boolean;
}

function Tooltip(props: TooltipProps) {
    const [expanded, setExpanded] = useState(false);

    return (
        <div onMouseLeave={() => setExpanded(false)} onMouseEnter={() => setExpanded(true)} className="relative">
            <div>{props.children}</div>
            {expanded ? (
                <div
                    style={{ top: '-0.5rem', left: '50%', transform: 'translate(-50%, -100%)' }}
                    className={
                        `max-w-md mt-2 z-50 py-1 px-2 bg-gray-900 text-gray-100 text-sm absolute flex flex-col border border-gray-200 dark:border-gray-800 rounded-md truncated ` +
                        (props.allowWrap ? 'whitespace-normal' : 'whitespace-nowrap')
                    }
                >
                    {props.content}
                </div>
            ) : null}
        </div>
    );
}

export default Tooltip;
