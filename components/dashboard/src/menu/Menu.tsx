/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router";
import { Location } from "history";
import { countries } from "countries-list";
import { getGitpodService, gitpodHostUrl } from "../service/service";
import { useCurrentUser } from "../user-context";
import ContextMenu, { ContextMenuEntry } from "../components/ContextMenu";
import { Separator } from "../components/Separator";
import PillMenuItem from "../components/PillMenuItem";
import { PaymentContext } from "../payment-context";
import FeedbackFormModal from "../feedback-form/FeedbackModal";
import OrganizationSelector from "./OrganizationSelector";
import { getAdminTabs } from "../admin/admin.routes";
import classNames from "classnames";
import { User, RoleOrPermission } from "@gitpod/public-api/lib/gitpod/v1/user_pb";
import { getPrimaryEmail } from "@gitpod/public-api-common/lib/user-utils";
import { ConfigurationsMigrationCoachmark } from "../repositories/coachmarks/MigrationCoachmark";
import { useInstallationConfiguration } from "../data/installation/installation-config-query";
import { useIsDataOps } from "../data/featureflag-query";
import { ProductLogo } from "../components/ProductLogo";

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
    const isDataOps = useIsDataOps();

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
                        <ConfigurationsMigrationCoachmark>
                            <OrganizationSelector />
                        </ConfigurationsMigrationCoachmark>
                        {/* Mobile Only Divider and User Menu */}
                        <div className="flex items-center md:hidden">
                            <div className="h-6 w-px bg-gray-300 dark:bg-gray-600 mx-2" />
                            <UserMenu user={user} className="" onFeedback={handleFeedbackFormClick} withAdminLink />
                        </div>
                        {/* Desktop Only Divider, User Menu, and Workspaces Nav */}
                        <div className="hidden md:flex items-center">
                            <div className="h-6 w-px bg-gray-300 dark:bg-gray-600 mx-2" />
                            <UserMenu user={user} className="" onFeedback={handleFeedbackFormClick} />
                            <div className="pl-2">
                                <OrgPagesNav />
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center w-auto" id="menu">
                        {/* Right side nav - Desktop Only */}
                        <nav className="hidden md:block flex-1">
                            <ul className="flex flex-1 items-center justify-end text-base text-gray-500 dark:text-gray-400 space-x-4">
                                {user?.rolesOrPermissions?.includes(RoleOrPermission.ADMIN) && (
                                    <li className="cursor-pointer">
                                        <PillMenuItem
                                            name="Admin"
                                            selected={isSelected(adminMenu, location)}
                                            link="/admin"
                                        />
                                    </li>
                                )}
                                {!isDataOps && (
                                    <li>
                                        <a
                                            href="/"
                                            className="flex items-center gap-x-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                                        >
                                            <ProductLogo className="h-4 w-auto" />
                                            <span>Gitpod Classic</span>
                                        </a>
                                    </li>
                                )}
                            </ul>
                        </nav>
                        {/* Right side items - Mobile Only */}
                        <div className="flex items-center space-x-3 md:hidden">
                            {!isDataOps && (
                                <a
                                    href="/"
                                    className="flex items-center gap-x-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                                >
                                    <ProductLogo className="h-4 w-auto" />
                                    <span>Gitpod Classic</span>
                                </a>
                            )}
                        </div>
                    </div>
                    {isFeedbackFormVisible && <FeedbackFormModal onClose={onFeedbackFormClose} />}
                </div>
            </header>
            <Separator />
            {/* Mobile-only OrgPagesNav and Separator */}
            <OrgPagesNav className="md:hidden app-container flex justify-start py-2" />
            <Separator className="md:hidden" />
        </>
    );
}

const leftMenu: Entry[] = [
    {
        title: "Workspaces",
        link: "/workspaces",
        alternatives: ["/"],
    },
];

type OrgPagesNavProps = {
    className?: string;
};
const OrgPagesNav: FC<OrgPagesNavProps> = ({ className }) => {
    const location = useLocation();

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
    onFeedback?: () => void;
};
const UserMenu: FC<UserMenuProps> = ({ user, className, withAdminLink, onFeedback }) => {
    const { data: installationConfig, isLoading: isInstallationConfigLoading } = useInstallationConfiguration();
    const isGitpodIo = isInstallationConfigLoading ? false : !installationConfig?.isDedicatedInstallation;

    const extraSection = useMemo(() => {
        const items: ContextMenuEntry[] = [];

        if (withAdminLink && user?.rolesOrPermissions?.includes(RoleOrPermission.ADMIN)) {
            items.push({
                title: "Admin",
                link: "/admin",
            });
        }

        // Add a separator to the last item
        if (items.length > 0) {
            items[items.length - 1].separator = true;
        }

        return items;
    }, [user?.rolesOrPermissions, withAdminLink]);

    const menuEntries = useMemo(() => {
        const baseEntries: ContextMenuEntry[] = [
            {
                title: (user && (getPrimaryEmail(user) || user?.name)) || "User",
                customFontStyle: "text-gray-400",
                separator: true,
            },
            {
                title: "User Settings",
                link: "/user/settings",
            },
            {
                title: "Docs",
                href: "https://www.gitpod.io/docs/introduction",
                target: "_blank",
                rel: "noreferrer",
            },
            {
                title: "Help",
                href: "https://www.gitpod.io/support/",
                target: "_blank",
                rel: "noreferrer",
                separator: !isGitpodIo,
            },
        ];

        if (isGitpodIo) {
            baseEntries.push({
                title: "Feedback",
                onClick: onFeedback,
                separator: true,
            });
        }

        baseEntries.push(...extraSection);

        baseEntries.push({
            title: "Log out",
            href: gitpodHostUrl.asApiLogout().toString(),
        });

        return baseEntries;
    }, [extraSection, user, isGitpodIo, onFeedback]);

    return (
        <div
            className={classNames(
                "ml-3 flex items-center justify-start mb-0 pointer-cursor m-l-auto rounded-full border-2 border-transparent hover:border-gray-200 dark:hover:border-gray-700 p-0.5 font-medium flex-shrink-0",
                className,
            )}
            data-analytics='{"label":"Account"}'
        >
            <ContextMenu menuEntries={menuEntries}>
                <img className="rounded-full w-8 h-8" src={user?.avatarUrl || ""} alt={user?.name || "Anonymous"} />
            </ContextMenu>
        </div>
    );
};

function isSelected(entry: Entry, location: Location<any>) {
    const all = [entry.link, ...(entry.alternatives || [])].map((l) => l.toLowerCase());
    const path = location.pathname.toLowerCase();
    return all.some((n) => n === path || n + "/" === path || path.startsWith(n + "/"));
}
