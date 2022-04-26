/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

export interface SelectableCardSolidProps {
    title: string;
    selected: boolean;
    className?: string;
    onClick: () => void;
    children?: React.ReactNode;
}

function SelectableCardSolid(props: SelectableCardSolidProps) {
    return (
        <div
            className={`rounded-xl px-3 py-3 cursor-pointer group transition ease-in-out relative ${
                props.selected
                    ? "bg-gray-800 dark:bg-gray-100"
                    : "bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
            } ${props.className || ""}`}
            onClick={props.onClick}
        >
            {props.children}
            <input className="opacity-0 absolute" type="radio" checked={props.selected} />
        </div>
    );
}

export default SelectableCardSolid;
