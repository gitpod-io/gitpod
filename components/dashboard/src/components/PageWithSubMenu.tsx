/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import classNames from "classnames";
import { FC, useEffect, useRef } from "react";
import { useLocation } from "react-router";
import { Link } from "react-router-dom";
import Header, { TabEntry } from "../components/Header";
import { Separator } from "./Separator";

export interface PageWithSubMenuProps {
    title: string;
    subtitle: string;
    subMenu: SubmenuItemProps[];
    tabs?: TabEntry[];
    children: React.ReactNode;
}

export function PageWithSubMenu(p: PageWithSubMenuProps) {
    return (
        <div className="w-full">
            <Header title={p.title} subtitle={p.subtitle} tabs={p.tabs} />
            <div className="app-container flex md:pt-9 flex-col md:flex-row">
                {/* TODO: extract into SubMenu component and show scrolling indicators */}
                <div>
                    <ul
                        className={classNames(
                            // Handle flipping between row and column layout
                            "flex flex-row md:flex-col items-center",
                            "w-full md:w-52 overflow-auto md:overflow-visible",
                            "pt-4 pb-4 md:pb-0",
                            "space-x-2 md:space-x-0 md:space-y-2",
                            "tracking-wide text-gray-500",
                        )}
                    >
                        {p.subMenu.map((e) => {
                            return <SubmenuItem title={e.title} link={e.link} key={e.title} />;
                        })}
                    </ul>
                </div>
                <div className="md:ml-16 lg:ml-32 w-full pt-1 mb-40">
                    <Separator className="md:hidden" />
                    <div className="pt-4 md:pt-0">{p.children}</div>
                </div>
            </div>
        </div>
    );
}

export type SubmenuItemProps = {
    title: string;
    link: string[];
    icon?: React.ReactNode;
};

export const SubmenuItem: FC<SubmenuItemProps> = ({ title, link, icon }) => {
    const location = useLocation();
    const itemRef = useRef<HTMLLIElement>(null);

    // TODO: can remove this once we use sub-routes and don't re-render the whole page for each sub-route
    useEffect(() => {
        if (itemRef.current && link.some((l) => l === location.pathname)) {
            itemRef.current.scrollIntoView({ behavior: "auto", block: "nearest", inline: "start" });
        }
    }, [link, location.pathname]);

    let classes = "flex justify-between items-center gap-2 block rounded-md py-2 px-4 whitespace-nowrap max-w-52";

    const isCurrent = link.some((l) => l === location.pathname);
    if (isCurrent) {
        classes += " bg-gray-300 text-gray-800 dark:bg-gray-800 dark:text-gray-50";
    } else {
        classes += " hover:bg-gray-100 dark:hover:bg-gray-800 dark:text-pk-content-secondary";
    }

    return (
        <Link to={link[0]} key={title} className="md:w-full rounded-md">
            <li ref={itemRef} className={classes}>
                {title} {icon}
            </li>
        </Link>
    );
};
