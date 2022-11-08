/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

function CheckBox(props: {
    name?: string;
    title: string | React.ReactNode;
    desc: string | React.ReactNode;
    checked: boolean;
    disabled?: boolean;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
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

    return (
        <div className="flex mt-4 max-w-2xl">
            <input
                className={
                    "h-4 w-4 focus:ring-0 mt-1 rounded cursor-pointer bg-transparent border-2 dark:filter-invert border-gray-800 dark:border-gray-900 focus:border-gray-900 dark:focus:border-gray-800 " +
                    (props.checked ? "bg-gray-800 dark:bg-gray-900" : "")
                }
                type="checkbox"
                id={checkboxId}
                {...inputProps}
            />
            <div className="flex flex-col ml-2">
                <label
                    htmlFor={checkboxId}
                    className={
                        "text-md font-semibold cursor-pointer tracking-wide " +
                        (inputProps.disabled ? "text-gray-500 dark:text-gray-400" : "text-gray-800 dark:text-gray-100")
                    }
                >
                    {props.title}
                </label>
                <div className="text-gray-500 dark:text-gray-400 text-md">{props.desc}</div>
            </div>
        </div>
    );
}

export default CheckBox;
