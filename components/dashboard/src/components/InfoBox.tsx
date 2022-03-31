/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import info from "../images/info.svg";

export default function InfoBox(p: { className?: string; children?: React.ReactNode }) {
    return (
        <div
            className={
                "flex rounded-xl bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 p-4 " +
                (p.className || "")
            }
        >
            <img className="w-4 h-4 m-1 ml-2 mr-4" src={info} />
            <span>{p.children}</span>
        </div>
    );
}

export function BlackBox(p: { className?: string; children?: React.ReactNode }) {
    return (
        <div
            className={
                "flex rounded-xl bg-gray-800 dark:bg-white text-white dark:text-gray-400 font-semibold text-xs w-72 h-64 px-4" +
                (p.className || "")
            }
        >
            <span>{p.children}</span>
        </div>
    );
}

export function LightBox(p: { className?: string; children?: React.ReactNode }) {
    return (
        <div
            className={
                "flex rounded-xl bg-gray-200 dark:bg-gray-900 text-gray-600 dark:text-gray-600 text-xs w-72 h-64 px-4" +
                (p.className || "")
            }
        >
            <span>{p.children}</span>
        </div>
    );
}
