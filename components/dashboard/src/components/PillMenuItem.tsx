/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Link } from "react-router-dom";

export default function PillMenuItem(p: {
    name: string;
    selected?: boolean;
    link?: string;
    additionalClasses?: string;
    onClick?: (event: React.MouseEvent) => void;
}) {
    let classes =
        "flex block font-medium dark:text-gray-400 px-3 py-1 rounded-2xl transition ease-in-out " +
        (p.selected
            ? "text-gray-500 bg-gray-50 dark:text-gray-100 dark:bg-gray-700"
            : "hover:bg-gray-100 dark:hover:bg-gray-700");
    if (p.additionalClasses) {
        classes = classes + " " + p.additionalClasses;
    }
    return !p.link || p.link.startsWith("https://") ? (
        <a className={classes} href={p.link} onClick={p.onClick} data-analytics='{"button_type":"pill_menu"}'>
            {p.name}
        </a>
    ) : (
        <Link className={classes} to={p.link} onClick={p.onClick} data-analytics='{"button_type":"pill_menu"}'>
            {p.name}
        </Link>
    );
}
