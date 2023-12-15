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

type CheckboxListFieldProps = {
    label: string;
    error?: ReactNode;
    className?: string;
    topMargin?: boolean;
};

// CheckboxListField is a wrapper for a list of related CheckboxInputField components.
export const CheckboxListField: FC<CheckboxListFieldProps> = ({ label, error, className, topMargin, children }) => {
    return (
        <InputField label={label} className={className} error={error} topMargin={topMargin}>
            <div className="space-y-2 ml-2">{children}</div>
        </InputField>
    );
};

type CheckboxInputFieldProps = {
    id?: string;
    value?: string;
    checked: boolean;
    disabled?: boolean;
    label: ReactNode;
    hint?: ReactNode;
    error?: ReactNode;
    topMargin?: boolean;
    containerClassName?: string;
    onChange: (checked: boolean) => void;
};
export const CheckboxInputField: FC<CheckboxInputFieldProps> = ({
    id,
    value,
    label,
    hint,
    error,
    checked,
    disabled = false,
    topMargin = true,
    containerClassName,
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
        // Intentionally not passing label and hint to InputField because we want to render them differently for checkboxes.
        <InputField error={error} topMargin={topMargin} className={containerClassName}>
            <label className="flex space-x-2 justify-start items-start max-w-lg" htmlFor={elementId}>
                <input
                    type="checkbox"
                    className={classNames(
                        "h-4 w-4 mt-0.5 rounded cursor-pointer border-2 dark:filter-invert",
                        "focus:ring-2 ring-blue-400",
                        "border-gray-600 dark:border-gray-900 bg-transparent",
                        "checked:bg-gray-600 dark:checked:bg-gray-900",
                    )}
                    id={elementId}
                    checked={checked}
                    disabled={disabled}
                    value={value}
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
        </InputField>
    );
};
