/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import classNames from "classnames";
import { Separator } from "./Separator";
import { cn } from "@podkit/lib/cn";
import { SubmenuItem, SubmenuItemProps } from "./PageWithSubMenu";

export interface PageWithSubMenuProps {
    /**
     * The name of the navigation menu, as read by screen readers.
     */
    navTitle?: string;
    subMenu: SubmenuItemProps[];
    children: React.ReactNode;
}

export function WidePageWithSubMenu(p: PageWithSubMenuProps) {
    return (
        <div className="w-full">
            <div className={cn("app-container flex flex-col md:flex-row")}>
                {/* TODO: extract into SubMenu component and show scrolling indicators */}
                <nav aria-label={p.navTitle}>
                    <ul
                        className={classNames(
                            // Handle flipping between row and column layout
                            "flex flex-row md:flex-col items-center",
                            "w-full md:w-52 overflow-auto md:overflow-visible",
                            "pt-4 pb-4 md:pt-0 md:pb-0",
                            "space-x-2 md:space-x-0 md:space-y-2",
                            "tracking-wide text-gray-500",
                        )}
                    >
                        {p.subMenu.map((e) => {
                            return <SubmenuItem title={e.title} link={e.link} key={e.title} icon={e.icon} />;
                        })}
                    </ul>
                </nav>
                {/* TODO: see if we want the content w/ top padding and not aligned on purpose */}
                <div className="md:ml-4 w-full pt-1 mb-40">
                    <Separator className="md:hidden" />
                    <div className="pt-4 md:pt-0">{p.children}</div>
                </div>
            </div>
        </div>
    );
}
