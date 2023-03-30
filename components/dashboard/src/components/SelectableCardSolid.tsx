/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useState } from "react";

export interface SelectableCardSolidProps {
    title: string;
    selected: boolean;
    className?: string;
    onClick: () => void;
    children?: React.ReactNode;
}

function SelectableCardSolid(props: SelectableCardSolidProps) {
    const [isFocused, setIsFocused] = useState(false);

    const handleFocus = () => {
        setIsFocused(true);
    };

    const handleBlur = () => {
        setIsFocused(false);
    };

    return (
        <div
            className={`rounded-xl px-3 py-3 flex flex-col cursor-pointer group transition ease-in-out ${
                isFocused ? "ring-2 ring-blue-500" : ""
            } ${
                props.selected
                    ? "bg-gray-800 dark:bg-gray-100"
                    : "bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
            } ${props.className || ""}`}
            onClick={props.onClick}
        >
            <div className="flex items-center">
                <p
                    className={`w-full pl-1 text-base font-semibold truncate ${
                        props.selected ? "text-gray-100 dark:text-gray-600" : "text-gray-600 dark:text-gray-500"
                    }`}
                    title={props.title}
                >
                    {props.title}
                </p>
                <input
                    className="opacity-0"
                    type="radio"
                    checked={props.selected}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                />
            </div>
            {props.children}
        </div>
    );
}

export default SelectableCardSolid;
