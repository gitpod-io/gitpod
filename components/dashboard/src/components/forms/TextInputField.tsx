/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import classNames from "classnames";
import { FunctionComponent, memo, ReactNode, useCallback } from "react";
import { useId } from "../../hooks/useId";
import { InputField } from "./InputField";

type Props = {
    type?: "text" | "password";
    label: ReactNode;
    value: string;
    id?: string;
    hint?: ReactNode;
    error?: ReactNode;
    placeholder?: string;
    disabled?: boolean;
    required?: boolean;
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
        onChange,
        onBlur,
    }) => {
        const maybeId = useId();
        const elementId = id || maybeId;

        return (
            <InputField id={elementId} label={label} hint={hint} error={error}>
                <TextInput
                    id={elementId}
                    value={value}
                    type={type}
                    placeholder={placeholder}
                    disabled={disabled}
                    required={required}
                    className={error ? "border-red-500" : ""}
                    onChange={onChange}
                    onBlur={onBlur}
                />
            </InputField>
        );
    },
);

type TextInputProps = {
    type?: "text" | "password";
    value: string;
    className?: string;
    id?: string;
    placeholder?: string;
    disabled?: boolean;
    required?: boolean;
    onChange: (newValue: string) => void;
    onBlur?: () => void;
};

export const TextInput: FunctionComponent<TextInputProps> = memo(
    ({ type = "text", value, className, id, placeholder, disabled = false, required = false, onChange, onBlur }) => {
        const handleChange = useCallback(
            (e) => {
                onChange(e.target.value);
            },
            [onChange],
        );

        const handleBlur = useCallback(() => onBlur && onBlur(), [onBlur]);

        return (
            <input
                id={id}
                className={classNames("w-full max-w-lg", className)}
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
