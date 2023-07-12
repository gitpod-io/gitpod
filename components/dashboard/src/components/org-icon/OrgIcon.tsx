/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import classNames from "classnames";
import { FunctionComponent } from "react";
import { consistentClassname } from "./consistent-classname";
import "./styles.css";

export type OrgIconProps = {
    id: string;
    name: string;
    className?: string;
};
export const OrgIcon: FunctionComponent<OrgIconProps> = ({ id, name, className }) => {
    const logoBGClass = consistentClassname(id);
    const initials = getOrgInitials(name);

    return (
        <div
            className={classNames(
                "rounded-full flex items-center justify-center flex-shrink-0 w-6 h-6",
                logoBGClass,
                className,
            )}
        >
            <span className="text-white font-semibold ">{initials}</span>
        </div>
    );
};

function getOrgInitials(name: string) {
    // If for some reason there is no name, default to G for Gitpod
    return (name || "G").charAt(0).toLocaleUpperCase();
}
