/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { cn } from "@podkit/lib/cn";
import { FC } from "react";

type HeadingProps = {
    id?: string;
    tracking?: "tight" | "wide";
    color?: "light" | "dark";
    className?: string;
};

export const Heading1: FC<HeadingProps> = ({ id, color, tracking, className, children }) => {
    return (
        <h1
            id={id}
            className={cn(
                "text-pk-content-primary",
                getTracking(tracking),
                "font-bold text-4xl leading-normal",
                className,
            )}
        >
            {children}
        </h1>
    );
};

export const Heading2: FC<HeadingProps> = ({ id, color, tracking, className, children }) => {
    return (
        <h2
            id={id}
            className={cn("text-pk-content-primary", getTracking(tracking), "font-semibold text-2xl", className)}
        >
            {children}
        </h2>
    );
};

export const Heading3: FC<HeadingProps> = ({ id, color, tracking, className, children }) => {
    return (
        <h3
            id={id}
            className={cn("text-pk-content-primary", getTracking(tracking), "font-semibold text-lg", className)}
        >
            {children}
        </h3>
    );
};

// Intended to be placed beneath a heading to provide more context
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
