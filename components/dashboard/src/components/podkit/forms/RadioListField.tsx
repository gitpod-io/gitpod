/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { cn } from "@podkit/lib/cn";
import * as RadioGroup from "@radix-ui/react-radio-group";
import { Circle } from "lucide-react";
import React, { useCallback } from "react";
import { useId } from "../../../hooks/useId";
import { InputField } from "../../forms/InputField";
import { InputFieldHint } from "../../forms/InputFieldHint";

type RadioListFieldProps = {
    id?: string;
    selectedValue: string;
    hint?: React.ReactNode;
    error?: React.ReactNode;
    topMargin?: boolean;
    onChange: (value: string) => void;
    children: RadioListItem[];
    className?: string;
};

export const RadioGroupItem = React.forwardRef<
    React.ElementRef<typeof RadioGroup.Item>,
    React.ComponentPropsWithoutRef<typeof RadioGroup.Item>
>(({ className, ...props }, ref) => {
    return (
        <RadioGroup.Item
            ref={ref}
            className={cn(
                "aspect-square h-4 w-4 rounded-full border ring-offset-white dark:ring-offset-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                "dark:accent-kumquat-ripe accent-gitpod-black",
                className,
            )}
            {...props}
        >
            <RadioGroup.Indicator className="flex items-center justify-center">
                <Circle className="h-2.5 w-2.5 fill-current text-current" />
            </RadioGroup.Indicator>
        </RadioGroup.Item>
    );
});
RadioGroupItem.displayName = RadioGroup.Item.displayName;

export type RadioListItem = {
    radio: React.ReactElement;
    label: React.ReactNode;
    hint?: React.ReactNode;
};

export const RadioListField: React.FC<RadioListFieldProps> = ({
    id,
    selectedValue,
    error,
    topMargin = true,
    onChange,
    children,
    className,
}) => {
    const maybeId = useId();
    const elementId = id || maybeId;

    const handleChange = useCallback(
        (value) => {
            onChange(value);
        },
        [onChange],
    );

    return (
        <InputField error={error} topMargin={topMargin}>
            <RadioGroup.Root
                className={cn("grid gap-2", className)}
                value={selectedValue}
                onValueChange={handleChange}
                aria-labelledby={elementId}
            >
                {children.map((child, index) => (
                    <div key={index} className="flex flex-col">
                        {React.cloneElement(child.radio, {
                            id: `${elementId}-${index}`,
                        })}
                        <label className="text-sm font-semibold pl-2 cursor-pointer" htmlFor={`${elementId}-${index}`}>
                            {child.label}
                        </label>
                        {child.hint && <InputFieldHint>{child.hint}</InputFieldHint>}
                    </div>
                ))}
            </RadioGroup.Root>
        </InputField>
    );
};
