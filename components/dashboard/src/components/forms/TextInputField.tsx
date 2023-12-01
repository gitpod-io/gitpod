/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FunctionComponent, memo, ReactNode, useCallback } from "react";
import { useId } from "../../hooks/useId";
import { InputField } from "./InputField";
import { cn } from "@podkit/lib/cn";

type TextInputFieldTypes = "text" | "password" | "email" | "url";

type Props = TextInputProps & {
    label?: ReactNode;
    hint?: ReactNode;
    error?: ReactNode;
    topMargin?: boolean;
    containerClassName?: string;
};

export const TextInputField: FunctionComponent<Props> = memo(
    ({
        type = "text",
        label,
        autoFocus,
        autoComplete,
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
                    autoFocus={autoFocus}
                    autoComplete={autoComplete}
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
    autoFocus?: boolean;
    autoComplete?: string;
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
    ({
        type = "text",
        value,
        className,
        id,
        placeholder,
        disabled = false,
        required = false,
        autoFocus = false,
        onChange,
        onBlur,
    }) => {
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
                className={cn("w-full max-w-lg dark:text-[#A8A29E]", className)}
                value={value}
                type={type}
                autoFocus={autoFocus}
                placeholder={placeholder}
                disabled={disabled}
                required={required}
                onChange={handleChange}
                onBlur={handleBlur}
            />
        );
    },
);
