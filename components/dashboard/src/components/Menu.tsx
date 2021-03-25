/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { User } from "@gitpod/gitpod-protocol";
import { useContext } from "react";
import { Link } from "react-router-dom";
import { gitpodHostUrl } from "../service/service";
import { UserContext } from "../user-context";
import ContextMenu from "./ContextMenu";
import * as images from '../images';
import { useLocation } from "react-router";
interface Entry {
    title: string, link: string, matches?: RegExp
}

function MenuItem(entry: Entry) {
    const location = useLocation();
    let classes = "flex block text-sm font-medium px-3 px-0 py-1.5 rounded-md";
    if (location.pathname.toLowerCase() === entry.link.toLowerCase() ||
        entry.matches && entry.matches.test(location.pathname.toLowerCase())) {
        classes += " bg-gray-200";
    } else {
        classes += " text-gray-600 hover:bg-gray-100 ";
    }
    return <li key={entry.title}>
        {entry.link.startsWith('https://')
            ? <a className={classes} href={entry.link}>
                <div>{entry.title}</div>
            </a>
            : <Link className={classes} to={entry.link}>
                <div>{entry.title}</div>
            </Link>}
    </li>;
}

function Menu(props: { left: Entry[], right: Entry[] }) {
    const { user } = useContext(UserContext);

    return (
        <header className="lg:px-28 px-10 bg-white flex flex-wrap items-center py-4">
            <div className="flex justify-between items-center pr-3">
                <Link to="/">
                    <img src={images.gitpodIcon} className="h-6" />
                </Link>
            </div>
            <div className="flex flex-1 items-center w-auto w-full" id="menu">
                <nav className="flex-1">
                    <ul className="flex flex-1 items-center justify-between text-base text-gray-700 space-x-2">
                        {props.left.map(MenuItem)}
                        <li className="flex-1"></li>
                        {props.right.map(MenuItem)}
                    </ul>
                </nav>
                <div className="ml-3 flex items-center justify-start mb-0 pointer-cursor m-l-auto rounded-full border-2 border-white hover:border-gray-200 p-0.5 font-medium">
                    <ContextMenu menuEntries={[
                    {
                        title: (user && User.getPrimaryEmail(user)) || '',
                        customFontStyle: 'text-gray-400',
                        separator: true
                    },
                    {
                        title: 'Settings',
                        link: '/settings',
                        separator: true
                    },
                    {
                        title: 'Logout',
                        href: gitpodHostUrl.asApiLogout().toString()
                    },
                    ]}>
                        <img className="rounded-full w-6 h-6"
                            src={user?.avatarUrl || ''} alt={user?.name || 'Anonymous'} />
                    </ContextMenu>
                </div>
            </div>
        </header>
    );
}

export default Menu;