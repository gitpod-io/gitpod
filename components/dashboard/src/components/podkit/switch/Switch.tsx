/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import React, { ReactNode } from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";
import { cn } from "@podkit/lib/cn";
import { TextMuted } from "@podkit/typography/TextMuted";

export const Switch = React.forwardRef<
    React.ElementRef<typeof SwitchPrimitives.Root>,
    React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => {
    return (
        <SwitchPrimitives.Root
            className={cn(
                // this gives the switch a line-height of 24px that matches the height of our base font size
                "my-0.5",
                "peer group inline-flex h-[20px] w-[36px] shrink-0 cursor-pointer items-center",
                "rounded-2xl transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                "focus-visible:outline-kumquat-ripe",
                "disabled:cursor-default disabled:bg-pk-surface-labels",
                "data-[state=checked]:disabled:bg-none",
                // checked state colors
                "data-[state=checked]:bg-kumquat-gradient",
                // unchecked state colors
                "data-[state=unchecked]:bg-pk-surface-labels",
                className,
            )}
            {...props}
            ref={ref}
        >
            <SwitchPrimitives.Thumb
                className={cn(
                    "pointer-events-none block h-[16px] w-[16px] rounded-full",
                    "bg-pk-surface-primary drop-shadow ring-0",
                    "group-disabled:bg-pk-surface-tertiary",
                    // Positioning
                    "transition-transform data-[state=checked]:translate-x-[17px] data-[state=unchecked]:translate-x-[3px]",
                )}
            />
        </SwitchPrimitives.Root>
    );
});
Switch.displayName = SwitchPrimitives.Root.displayName;

export interface SwitchInputFieldProps extends React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> {
    id?: string;
    label: ReactNode;
    description?: ReactNode;
    labelLayout?: "row" | "column";
}

export const SwitchInputField = React.forwardRef<React.ElementRef<typeof SwitchPrimitives.Root>, SwitchInputFieldProps>(
    ({ className, checked, onCheckedChange, title, label, id, description, labelLayout, ...props }, ref) => {
        const disabledClassName = props.disabled ? "text-pk-content-disabled" : "";
        const centerItemsClassName = labelLayout === "row" ? "items-center" : "";
        const labelLayoutClassName = labelLayout === "row" ? "flex-row" : "flex-col";
        const switchProps = {
            ...props,
            className: "",
        };
        return (
            <div className={cn("flex gap-4", centerItemsClassName, className)} title={title}>
                <Switch checked={checked} onCheckedChange={onCheckedChange} id={id} {...switchProps} ref={ref} />
                <div className={cn("flex", labelLayoutClassName, centerItemsClassName, disabledClassName)}>
                    <label className={cn("flex flex-row items-center font-semibold cursor-pointer")} htmlFor={id}>
                        {label}
                    </label>
                    {typeof description === "string" ? <TextMuted>{description}</TextMuted> : description}
                </div>
            </div>
        );
    },
);
