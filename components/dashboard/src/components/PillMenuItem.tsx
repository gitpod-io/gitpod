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
    const classes = 'flex block text-sm font-medium dark:text-gray-200 px-3 px-0 py-1.5 rounded-md transition ease-in-out ' +
        (p.selected
            ? 'bg-gray-200 dark:bg-gray-700'
            : 'text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800');
    return ((!p.link || p.link.startsWith('https://'))
        ? <a className={classes} href={p.link} onClick={p.onClick}>{p.name}</a>
        : <Link className={classes} to={p.link} onClick={p.onClick}>{p.name}</Link>);
}