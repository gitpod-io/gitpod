/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import classNames from "classnames";
import { FC, ReactNode, useCallback } from "react";
import { useId } from "../../hooks/useId";
import { InputField } from "./InputField";
import { InputFieldHint } from "./InputFieldHint";

type CheckboxInputFieldProps = {
    label: string;
    error?: ReactNode;
    className?: string;
};
export const CheckboxInputField: FC<CheckboxInputFieldProps> = ({ label, error, className, children }) => {
    return (
        <InputField label={label} className={className} error={error}>
            <div className="space-y-2 ml-2">{children}</div>
        </InputField>
    );
};

type CheckboxInputProps = {
    id?: string;
    value: string;
    checked: boolean;
    disabled?: boolean;
    label: string;
    hint?: string;
    onChange: (checked: boolean) => void;
};
export const CheckboxInput: FC<CheckboxInputProps> = ({
    id,
    value,
    label,
    hint,
    checked,
    disabled = false,
    onChange,
}) => {
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
                className={classNames(
                    "h-4 w-4 mt-0.5 rounded cursor-pointer border-2 dark:filter-invert",
                    "focus:ring-2 focus:border-gray-900 ring-blue-400 dark:focus:border-gray-800",
                    "border-gray-600 dark:border-gray-900 bg-transparent",
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
                    className={classNames(
                        "text-sm font-semibold cursor-pointer",
                        disabled ? "text-gray-400 dark:text-gray-400" : "text-gray-600 dark:text-gray-100",
                    )}
                >
                    {label}
                </span>

                {hint && <InputFieldHint disabled={disabled}>{hint}</InputFieldHint>}
            </div>
        </label>
    );
};
