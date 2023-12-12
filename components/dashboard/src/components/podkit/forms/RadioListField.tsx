/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { cn } from "@podkit/lib/cn";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { Circle } from "lucide-react";
import React from "react";

export const RadioGroupItem = React.forwardRef<
    React.ElementRef<typeof RadioGroupPrimitive.Item>,
    React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>
>(({ className, ...props }, ref) => {
    return (
        // TODO: Decide if we want to keep this here, or move it to another layer of abstraction
        // This allows the radio height to match text-sm (which should be used for labels here) line-height
        <span className="h-5 flex items-center">
            <RadioGroupPrimitive.Item
                ref={ref}
                className={cn(
                    "aspect-square h-4 w-4 my-0 rounded-full border-2 ring-offset-white dark:ring-offset-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 p-0 text-black dark:text-gray-200 border-black dark:border-gray-200 bg-inherit",
                    className,
                )}
                {...props}
            >
                <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
                    <Circle className="h-1.5 w-1.5 fill-current text-current" />
                </RadioGroupPrimitive.Indicator>
            </RadioGroupPrimitive.Item>
        </span>
    );
});
RadioGroupItem.displayName = RadioGroupPrimitive.Item.displayName;

export type RadioListItem = {
    radio: React.ReactElement;
    label: React.ReactNode;
    hint?: React.ReactNode;
};

export const RadioGroup = React.forwardRef<
    React.ElementRef<typeof RadioGroupPrimitive.Root>,
    React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(({ className, ...props }, ref) => {
    return <RadioGroupPrimitive.Root className={cn("grid gap-2", className)} {...props} ref={ref} />;
});
RadioGroup.displayName = RadioGroupPrimitive.Root.displayName;
