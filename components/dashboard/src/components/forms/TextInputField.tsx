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
    ({ label, id, hint, error, topMargin, containerClassName, ...props }) => {
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
                <TextInput id={elementId} className={error ? "error" : ""} {...props} />
            </InputField>
        );
    },
);

interface TextInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "type"> {
    type?: TextInputFieldTypes;
    onChange?: (newValue: string) => void;
    onBlur?: () => void;
}

export const TextInput: FunctionComponent<TextInputProps> = memo(({ className, onChange, onBlur, ...props }) => {
    const handleChange = useCallback(
        (e) => {
            onChange && onChange(e.target.value);
        },
        [onChange],
    );

    const handleBlur = useCallback(() => onBlur && onBlur(), [onBlur]);

    return (
        <input
            className={cn("w-full max-w-lg dark:text-[#A8A29E]", className)}
            onChange={handleChange}
            onBlur={handleBlur}
            {...props}
        />
    );
});
