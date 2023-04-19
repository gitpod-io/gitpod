/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { User } from "@gitpod/gitpod-protocol";
import { FC, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLocation } from "react-router";
import { Location } from "history";
import { countries } from "countries-list";
import gitpodIcon from "../icons/gitpod.svg";
import { getGitpodService, gitpodHostUrl } from "../service/service";
import { useCurrentUser } from "../user-context";
import ContextMenu, { ContextMenuEntry } from "../components/ContextMenu";
import { Separator } from "../components/Separator";
import PillMenuItem from "../components/PillMenuItem";
import { PaymentContext } from "../payment-context";
import FeedbackFormModal from "../feedback-form/FeedbackModal";
import { isGitpodIo } from "../utils";
import OrganizationSelector from "./OrganizationSelector";
import { getAdminTabs } from "../admin/admin.routes";
import classNames from "classnames";

interface Entry {
    title: string;
    link: string;
    alternatives?: string[];
}

export default function Menu() {
    const user = useCurrentUser();
    const location = useLocation();
    const { setCurrency } = useContext(PaymentContext);
    const [isFeedbackFormVisible, setFeedbackFormVisible] = useState<boolean>(false);

    useEffect(() => {
        const { server } = getGitpodService();
        server.getClientRegion().then((v) => {
            // @ts-ignore
            setCurrency(countries[v]?.currency === "EUR" ? "EUR" : "USD");
        });
    }, [setCurrency]);

    const adminMenu: Entry = useMemo(
        () => ({
            title: "Admin",
            link: "/admin",
            alternatives: [
                ...getAdminTabs().reduce(
                    (prevEntry, currEntry) =>
                        currEntry.alternatives
                            ? [...prevEntry, ...currEntry.alternatives, currEntry.link]
                            : [...prevEntry, currEntry.link],
                    [] as string[],
                ),
            ],
        }),
        [],
    );

    const handleFeedbackFormClick = useCallback(() => {
        setFeedbackFormVisible(true);
    }, []);

    const onFeedbackFormClose = useCallback(() => {
        setFeedbackFormVisible(false);
    }, []);

    return (
        <>
            <header className="app-container flex flex-col pt-4" data-analytics='{"button_type":"menu"}'>
                <div className="flex justify-between h-10 mb-3 w-full">
                    <div className="flex items-center">
                        {/* hidden on smaller screens */}
                        <Link to="/" className="hidden md:inline pr-3 w-10">
                            <img src={gitpodIcon} className="h-6" alt="Gitpod's logo" />
                        </Link>
                        <OrganizationSelector />
                        {/* hidden on smaller screens (in it's own menu below on smaller screens) */}
                        <div className="hidden md:block pl-2">
                            <OrgPagesNav />
                        </div>
                    </div>
                    <div className="flex items-center w-auto" id="menu">
                        {/* hidden on smaller screens - TODO: move to user menu on smaller screen */}
                        <nav className="hidden md:block flex-1">
                            <ul className="flex flex-1 items-center justify-between text-base text-gray-500 dark:text-gray-400 space-x-2">
                                <li className="flex-1"></li>
                                {user?.rolesOrPermissions?.includes("admin") && (
                                    <li className="cursor-pointer">
                                        <PillMenuItem
                                            name="Admin"
                                            selected={isSelected(adminMenu, location)}
                                            link="/admin"
                                        />
                                    </li>
                                )}
                                {isGitpodIo() && (
                                    <li className="cursor-pointer">
                                        <PillMenuItem name="Feedback" onClick={handleFeedbackFormClick} />
                                    </li>
                                )}
                            </ul>
                        </nav>
                        {/* Hide normal user menu on small screens */}
                        <UserMenu user={user} className="hidden md:block" />
                        {/* Show a user menu w/ admin & feedback links on small screens */}
                        <UserMenu
                            user={user}
                            className="md:hidden"
                            withAdminLink
                            withFeedbackLink
                            onFeedback={handleFeedbackFormClick}
                        />
                    </div>
                    {isFeedbackFormVisible && <FeedbackFormModal onClose={onFeedbackFormClose} />}
                </div>
            </header>
            <Separator />
            {/* only shown on small screens */}
            <OrgPagesNav className="md:hidden app-container flex justify-start py-2" />
            {/* only shown on small screens */}
            <Separator className="md:hidden" />
        </>
    );
}

type OrgPagesNavProps = {
    className?: string;
};
const OrgPagesNav: FC<OrgPagesNavProps> = ({ className }) => {
    const location = useLocation();

    const leftMenu: Entry[] = useMemo(
        () => [
            {
                title: "Workspaces",
                link: "/workspaces",
                alternatives: ["/"],
            },
            {
                title: "Projects",
                link: `/projects`,
                alternatives: [] as string[],
            },
        ],
        [],
    );

    return (
        <div
            className={classNames(
                "text-base text-gray-500 dark:text-gray-400 flex items-center space-x-1 py-1",
                className,
            )}
        >
            {leftMenu.map((entry) => (
                <div key={entry.title}>
                    <PillMenuItem name={entry.title} selected={isSelected(entry, location)} link={entry.link} />
                </div>
            ))}
        </div>
    );
};

type UserMenuProps = {
    user?: User;
    className?: string;
    withAdminLink?: boolean;
    withFeedbackLink?: boolean;
    onFeedback?: () => void;
};
const UserMenu: FC<UserMenuProps> = ({ user, className, withAdminLink, withFeedbackLink, onFeedback }) => {
    const extraSection = useMemo(() => {
        const items: ContextMenuEntry[] = [];

        if (withAdminLink && user?.rolesOrPermissions?.includes("admin")) {
            items.push({
                title: "Admin",
                link: "/admin",
            });
        }
        if (withFeedbackLink && isGitpodIo()) {
            items.push({
                title: "Feedback",
                onClick: onFeedback,
            });
        }

        // Add a separator to the last item
        if (items.length > 0) {
            items[items.length - 1].separator = true;
        }

        return items;
    }, [onFeedback, user?.rolesOrPermissions, withAdminLink, withFeedbackLink]);

    return (
        <div
            className={classNames(
                "ml-3 flex items-center justify-start mb-0 pointer-cursor m-l-auto rounded-full border-2 border-transparent hover:border-gray-200 dark:hover:border-gray-700 p-0.5 font-medium flex-shrink-0",
                className,
            )}
            data-analytics='{"label":"Account"}'
        >
            <ContextMenu
                menuEntries={[
                    {
                        title: (user && (User.getPrimaryEmail(user) || user?.name)) || "User",
                        customFontStyle: "text-gray-400",
                        separator: true,
                    },
                    {
                        title: "User Settings",
                        link: "/user/settings",
                    },
                    {
                        title: "Docs",
                        href: "https://www.gitpod.io/docs/",
                        target: "_blank",
                        rel: "noreferrer",
                    },
                    {
                        title: "Help",
                        href: "https://www.gitpod.io/support/",
                        target: "_blank",
                        rel: "noreferrer",
                        separator: true,
                    },
                    ...extraSection,
                    {
                        title: "Logout",
                        href: gitpodHostUrl.asApiLogout().toString(),
                    },
                ]}
            >
                <img className="rounded-full w-8 h-8" src={user?.avatarUrl || ""} alt={user?.name || "Anonymous"} />
            </ContextMenu>
        </div>
    );
};

function isSelected(entry: Entry, location: Location<any>) {
    const all = [entry.link, ...(entry.alternatives || [])].map((l) => l.toLowerCase());
    const path = location.pathname.toLowerCase();
    return all.some((n) => n === path || n + "/" === path);
}
