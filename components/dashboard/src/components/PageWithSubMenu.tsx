/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { useLocation } from "react-router";
import { Link } from "react-router-dom";
import Header from '../components/Header';

export interface PageWithSubMenuProps {
    title: string;
    subtitle: string;
    subMenu: {
        title: string,
        link: string[]
    }[];
    children: React.ReactNode;
}

export function PageWithSubMenu(p: PageWithSubMenuProps) {
    const location = useLocation();
    return <div className="w-full">
        <Header title={p.title} subtitle={p.subtitle} />
        <div className='app-container flex pt-9'>
            <div>
                <ul className="flex flex-col text tracking-wide text-gray-500 pt-4 lg:pt-0 w-48 space-y-2">
                    {p.subMenu.map(e => {
                        let classes = "flex block py-2 px-4 rounded-md";
                        if (e.link.some(l => l === location.pathname)) {
                            classes += " bg-gray-800 text-gray-50";
                        } else {
                            classes += " hover:bg-gray-100 dark:hover:bg-gray-800";
                        }
                        return <Link to={e.link[0]} key={e.title}>
                            <li className={classes}>
                                {e.title}
                            </li>
                        </Link>;
                    })}
                </ul>
            </div>
            <div className='ml-32 w-full pt-1'>
                {p.children}
            </div>
        </div>
    </div>;
}
