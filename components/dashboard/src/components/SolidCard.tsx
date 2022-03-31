/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

function SolidCard(p: { className?: string; children?: React.ReactNode }) {
    return (
        <div
            className={
                "flex rounded-xl w-72 h-64 px-4 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-600" +
                (p.className || "")
            }
        >
            <span>{p.children}</span>
        </div>
    );
}

export default SolidCard;
