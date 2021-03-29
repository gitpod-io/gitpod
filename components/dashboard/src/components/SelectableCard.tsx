/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

export interface SelectableCardProps {
    title: string;
    selected: boolean;
    className?: string;
    onClick: () => void;
    children?: React.ReactNode;
}

function SelectableCard(props: SelectableCardProps) {
    return <div className={`rounded-xl px-4 py-3 flex flex-col cursor-pointer group border-2 transition ease-in-out ${props.selected ? 'border-green-500' : 'border-gray-300 hover:border-gray-400'} ${props.className || ''}`} onClick={props.onClick}>
        <div className="flex items-center">
            <p className={`w-full text-base font-semibold ${props.selected ? 'text-green-500' : 'text-gray-300 group-hover:text-gray-400'}`}>{props.title}</p>
            <input className={'text-green-500 ' + (props.selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')} type="radio" checked={props.selected} />
        </div>
        {props.children}
    </div>;
}

export default SelectableCard;
