/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

function SolidCard(p: { className?: string; onClick?: () => void; children?: React.ReactNode }) {
    return (
        <div
            className={`flex flex-col rounded-xl px-4 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 ${
                p.className || ""
            }`}
            onClick={p.onClick}
        >
            {p.children}
        </div>
    );
}

export default SolidCard;
