/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Link } from "react-router-dom";

export default function TabMenuItem(p: {
    name: string,
    selected: boolean,
    link?: string,
    onClick?: (event: React.MouseEvent) => void
}) {
    const classes = 'cursor-pointer py-2 px-4 border-b-4 border-transparent transition ease-in-out ' +
        (p.selected
            ? 'text-gray-600 dark:text-gray-400 border-gray-700 dark:border-gray-400'
            : 'text-gray-400 dark:text-gray-600 hover:border-gray-400 dark:hover:border-gray-600');
    return ((!p.link || p.link.startsWith('https://'))
        ? <a className={classes} href={p.link} onClick={p.onClick} data-analytics='{"button_type":"tab_menu"}'>{p.name}</a>
        : <Link className={classes} to={p.link} onClick={p.onClick} data-analytics='{"button_type":"tab_menu"}'>{p.name}</Link>);
}