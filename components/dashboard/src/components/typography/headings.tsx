/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import classNames from "classnames";
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
            className={classNames(
                getHeadingColor(color),
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
            className={classNames(getHeadingColor(color), getTracking(tracking), "font-semibold text-2xl", className)}
        >
            {children}
        </h2>
    );
};

export const Heading3: FC<HeadingProps> = ({ id, color, tracking, className, children }) => {
    return (
        <h3
            id={id}
            className={classNames(getHeadingColor(color), getTracking(tracking), "font-semibold text-lg", className)}
        >
            {children}
        </h3>
    );
};

// Intended to be placed beneath a heading to provide more context
export const Subheading: FC<HeadingProps> = ({ id, tracking, className, children }) => {
    return (
        <p
            id={id}
            className={classNames("text-base text-gray-500 dark:text-gray-500", getTracking(tracking), className)}
        >
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
