/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */


function CheckBox(props: {
    name?: string,
    title: string,
    desc: string,
    checked: boolean,
    disabled?: boolean,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}) {
    const inputProps: React.InputHTMLAttributes<HTMLInputElement> = {
        checked: props.checked,
        disabled: props.disabled,
        onChange: props.onChange,
    };
    if (props.name) {
        inputProps.name = props.name;
    }

    const checkboxId = `checkbox-${props.title}-${String(Math.random())}`;

    return <div className="flex mt-4">
        <input className={"h-4 w-4 focus:ring-0 mt-1 rounded cursor-pointer border border-gray-300 focus:border-gray-400 " + (props.checked ? 'bg-gray-800' : '')} type="checkbox"
            id={checkboxId}
            {...inputProps}
        />
        <div className="flex flex-col ml-2">
            <label htmlFor={checkboxId} className="text-gray-800 text-md font-semibold tracking-wide">{props.title}</label>
            <div className="text-gray-400 text-md">{props.desc}</div>
        </div>
    </div>
}

export default CheckBox;