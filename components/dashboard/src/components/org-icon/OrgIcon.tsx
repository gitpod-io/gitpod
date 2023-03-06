/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import classNames from "classnames";
import { FunctionComponent } from "react";
import { consistentClassname } from "./consistent-classname";
import "./styles.css";

const SIZE_CLASSES = {
    small: "w-6 h-6",
    medium: "w-10 h-10",
};

const TEXT_SIZE_CLASSES = {
    small: "text-sm",
    medium: "text-xl",
};

export type OrgIconProps = {
    id: string;
    name: string;
    size?: keyof typeof SIZE_CLASSES;
    className?: string;
};
export const OrgIcon: FunctionComponent<OrgIconProps> = ({ id, name, size = "medium", className }) => {
    const logoBGClass = consistentClassname(id);
    const initials = getOrgInitials(name);
    const sizeClasses = SIZE_CLASSES[size];
    const textClass = TEXT_SIZE_CLASSES[size];

    return (
        <div
            className={classNames(
                "rounded-full flex items-center justify-center flex-shrink-0",
                sizeClasses,
                logoBGClass,
                className,
            )}
        >
            <span className={`text-white font-semibold ${textClass}`}>{initials}</span>
        </div>
    );
};

function getOrgInitials(name: string) {
    // If for some reason there is no name, default to G for Gitpod
    return (name || "G").charAt(0).toLocaleUpperCase();
}
