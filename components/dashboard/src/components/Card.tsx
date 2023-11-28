/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

function Card(p: { className?: string; onClick?: () => void; children?: React.ReactNode }) {
    return (
        <div
            className={`flex flex-col rounded-xl px-4 bg-gray-800 dark:bg-gray-100 text-gray-200 dark:text-gray-500 ${
                p.className || ""
            }`}
            onClick={p.onClick}
        >
            {p.children}
        </div>
    );
}

export default Card;
