/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { cn } from "@podkit/lib/cn";
import { FC } from "react";
import { Slot } from "@radix-ui/react-slot";

type HeadingProps = {
    id?: string;
    tracking?: "tight" | "wide";
    className?: string;
    asChild?: boolean;
};

export const Heading1: FC<HeadingProps> = ({ id, tracking, className, children, asChild }) => {
    const Comp = asChild ? Slot : "h1";

    return (
        <Comp
            id={id}
            className={cn(
                "text-pk-content-primary",
                getTracking(tracking),
                "font-semibold text-3xl truncate",
                className,
            )}
        >
            {children}
        </Comp>
    );
};

export const Heading2: FC<HeadingProps> = ({ id, tracking, className, children, asChild }) => {
    const Comp = asChild ? Slot : "h2";

    return (
        <Comp
            id={id}
            className={cn("text-pk-content-primary", getTracking(tracking), "font-semibold text-2xl", className)}
        >
            {children}
        </Comp>
    );
};

export const Heading3: FC<HeadingProps> = ({ id, tracking, className, children, asChild }) => {
    const Comp = asChild ? Slot : "h3";

    return (
        <Comp
            id={id}
            className={cn("text-pk-content-primary", getTracking(tracking), "font-semibold text-lg", className)}
        >
            {children}
        </Comp>
    );
};

/**
 * Intended to be placed beneath a heading to provide more context
 */
export const Subheading: FC<HeadingProps> = ({ id, tracking, className, children }) => {
    return (
        <p id={id} className={cn("text-base text-pk-content-secondary", getTracking(tracking), className)}>
            {children}
        </p>
    );
};

function getTracking(tracking: HeadingProps["tracking"]) {
    if (tracking === "wide") {
        return "tracking-wide";
    } else if (tracking === "tight") {
        return "tracking-tight";
    }

    return null;
}
