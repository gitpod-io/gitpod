/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import classNames from "classnames";
import { FC, useCallback } from "react";
import { useId } from "../../hooks/useId";
import { InputFieldHint } from "./InputFieldHint";

type Props = {
    id?: string;
    value: string;
    checked: boolean;
    disabled?: boolean;
    label: string;
    hint?: string;
    onChange: (checked: boolean) => void;
};
export const CheckboxInput: FC<Props> = ({ id, value, label, hint, checked, disabled = false, onChange }) => {
    const maybeId = useId();
    const elementId = id || maybeId;

    const handleChange = useCallback(
        (e) => {
            onChange(e.target.checked);
        },
        [onChange],
    );

    return (
        <label className="flex space-x-2 justify-start items-start" htmlFor={elementId}>
            <input
                type="checkbox"
                // className="rounded border-2 mt-0.5 text-gray-600"
                className={classNames(
                    "h-4 w-4 focus:ring-0 mt-0.5 rounded cursor-pointer bg-transparent border-2 dark:filter-invert border-gray-600 dark:border-gray-900 focus:border-gray-900 dark:focus:border-gray-800",
                    { "bg-gray-600 dark:bg-gray-900": checked },
                )}
                value={value}
                id={elementId}
                checked={checked}
                disabled={disabled}
                onChange={handleChange}
            />
            <div className="flex flex-col">
                <span
                    // className="text-gray-600 dark:text-gray-400 text-sm"
                    className={classNames(
                        "text-md font-semibold cursor-pointer tracking-wide",
                        disabled ? "text-gray-400 dark:text-gray-400" : "text-gray-600 dark:text-gray-100",
                    )}
                >
                    {label}
                </span>

                {hint && <InputFieldHint>{hint}</InputFieldHint>}
            </div>
        </label>
    );
};
