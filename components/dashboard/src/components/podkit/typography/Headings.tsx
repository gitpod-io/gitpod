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
    color?: "light" | "dark";
    className?: string;
    asChild?: boolean;
};

export const Heading1: FC<HeadingProps> = ({ id, color, tracking, className, children, asChild }) => {
    const Comp = asChild ? Slot : "h1";

    return (
        <Comp
            id={id}
            className={cn(getHeadingColor(color), getTracking(tracking), "font-bold text-3xl truncate", className)}
        >
            {children}
        </Comp>
    );
};

export const Heading2: FC<HeadingProps> = ({ id, color, tracking, className, children, asChild }) => {
    const Comp = asChild ? Slot : "h2";

    return (
        <Comp
            id={id}
            className={cn(getHeadingColor(color), getTracking(tracking), "font-semibold text-2xl", className)}
        >
            {children}
        </Comp>
    );
};

export const Heading3: FC<HeadingProps> = ({ id, color, tracking, className, children, asChild }) => {
    const Comp = asChild ? Slot : "h3";

    return (
        <Comp id={id} className={cn(getHeadingColor(color), getTracking(tracking), "font-semibold text-lg", className)}>
            {children}
        </Comp>
    );
};

/**
 * Intended to be placed beneath a heading to provide more context
 */
export const Subheading: FC<HeadingProps> = ({ id, tracking, className, children }) => {
    return (
        <p id={id} className={cn("text-base text-gray-500 dark:text-gray-400", getTracking(tracking), className)}>
            {children}
        </p>
    );
};

function getHeadingColor(color: HeadingProps["color"] = "dark") {
    return color === "dark" ? "text-gray-800 dark:text-gray-100" : "text-gray-500 dark:text-gray-400";
}

function getTracking(tracking: HeadingProps["tracking"]) {
    if (tracking === "wide") {
        return "tracking-wide";
    } else if (tracking === "tight") {
        return "tracking-tight";
    }

    return null;
}
