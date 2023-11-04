/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import classNames from "classnames";
import { FunctionComponent, memo, ReactNode, useCallback } from "react";
import { useId } from "../../hooks/useId";
import { InputField } from "./InputField";

type TextInputFieldTypes = "text" | "password" | "email" | "url";

type Props = {
    type?: TextInputFieldTypes;
    label?: ReactNode;
    value: string;
    id?: string;
    hint?: ReactNode;
    error?: ReactNode;
    placeholder?: string;
    disabled?: boolean;
    required?: boolean;
    topMargin?: boolean;
    containerClassName?: string;
    onChange: (newValue: string) => void;
    onBlur?: () => void;
};

export const TextInputField: FunctionComponent<Props> = memo(
    ({
        type = "text",
        label,
        value,
        id,
        placeholder,
        hint,
        error,
        disabled = false,
        required = false,
        topMargin,
        containerClassName,
        onChange,
        onBlur,
    }) => {
        const maybeId = useId();
        const elementId = id || maybeId;

        return (
            <InputField
                id={elementId}
                label={label}
                hint={hint}
                error={error}
                topMargin={topMargin}
                className={containerClassName}
            >
                <TextInput
                    id={elementId}
                    value={value}
                    type={type}
                    placeholder={placeholder}
                    disabled={disabled}
                    required={required}
                    className={error ? "error" : ""}
                    onChange={onChange}
                    onBlur={onBlur}
                />
            </InputField>
        );
    },
);

type TextInputProps = {
    type?: TextInputFieldTypes;
    value: string;
    className?: string;
    id?: string;
    placeholder?: string;
    disabled?: boolean;
    required?: boolean;
    onChange?: (newValue: string) => void;
    onBlur?: () => void;
};

export const TextInput: FunctionComponent<TextInputProps> = memo(
    ({ type = "text", value, className, id, placeholder, disabled = false, required = false, onChange, onBlur }) => {
        const handleChange = useCallback(
            (e) => {
                onChange && onChange(e.target.value);
            },
            [onChange],
        );

        const handleBlur = useCallback(() => onBlur && onBlur(), [onBlur]);

        return (
            <input
                id={id}
                className={classNames("w-full max-w-lg dark:text-[#A8A29E]", className)}
                value={value}
                type={type}
                placeholder={placeholder}
                disabled={disabled}
                required={required}
                onChange={handleChange}
                onBlur={handleBlur}
            />
        );
    },
);
