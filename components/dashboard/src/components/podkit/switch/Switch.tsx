/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";
import { cn } from "@podkit/lib/cn";

export const Switch = React.forwardRef<
    React.ElementRef<typeof SwitchPrimitives.Root>,
    React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => {
    return (
        <SwitchPrimitives.Root
            className={cn(
                // this gives the switch a line-height of 24px that matches the height of our base font size
                "my-0.5",
                "peer inline-flex h-[20px] w-[36px] shrink-0 cursor-pointer items-center",
                "rounded-2xl transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                "focus-visible:outline-kumquat-ripe",
                "disabled:cursor-default disabled:bg-pk-surface-labels",
                // TODO: try and make kumquat-gradient work here for the bg
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
                    "disabled:bg-pk-surface-tertiary",
                    // Positioning
                    "transition-transform data-[state=checked]:translate-x-[17px] data-[state=unchecked]:translate-x-[3px]",
                )}
            />
        </SwitchPrimitives.Root>
    );
});
Switch.displayName = SwitchPrimitives.Root.displayName;
