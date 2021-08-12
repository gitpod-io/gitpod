/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Link } from "react-router-dom";

export default function PillMenuItem(p: {
    name: string,
    selected: boolean,
    link?: string,
    onClick?: (event: React.MouseEvent) => void
}) {
    const classes = 'flex block font-medium dark:text-gray-200 px-2 py-1 rounded-lg transition ease-in-out ' +
        (p.selected
            ? 'bg-gray-200 dark:bg-gray-700'
            : 'text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800');
    return ((!p.link || p.link.startsWith('https://'))
        ? <a className={classes} href={p.link} onClick={p.onClick} data-analytics='{"button_type":"pill_menu"}'>{p.name}</a>
        : <Link className={classes} to={p.link} onClick={p.onClick} data-analytics='{"button_type":"pill_menu"}'>{p.name}</Link>);
}