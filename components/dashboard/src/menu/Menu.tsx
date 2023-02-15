/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { User } from "@gitpod/gitpod-protocol";
import { FunctionComponent, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLocation } from "react-router";
import { Location } from "history";
import { countries } from "countries-list";
import gitpodIcon from "../icons/gitpod.svg";
import { getGitpodService, gitpodHostUrl } from "../service/service";
import { useCurrentUser } from "../user-context";
import ContextMenu, { ContextMenuEntry } from "../components/ContextMenu";
import Separator from "../components/Separator";
import PillMenuItem from "../components/PillMenuItem";
import { PaymentContext } from "../payment-context";
import FeedbackFormModal from "../feedback-form/FeedbackModal";
import { isGitpodIo } from "../utils";
import OrganizationSelector from "./OrganizationSelector";

interface Entry {
    title: string;
    link: string;
    alternatives?: string[];
}

export default function Menu() {
    const user = useCurrentUser();
    const location = useLocation();
    const { setCurrency, setIsStudent, setIsChargebeeCustomer } = useContext(PaymentContext);

    function isSelected(entry: Entry, location: Location<any>) {
        const all = [entry.link, ...(entry.alternatives || [])].map((l) => l.toLowerCase());
        const path = location.pathname.toLowerCase();
        return all.some((n) => n === path || n + "/" === path);
    }

    useEffect(() => {
        const { server } = getGitpodService();
        Promise.all([
            server.getClientRegion().then((v) => () => {
                // @ts-ignore
                setCurrency(countries[v]?.currency === "EUR" ? "EUR" : "USD");
            }),
            server.isStudent().then((v) => () => setIsStudent(v)),
            server.isChargebeeCustomer().then((v) => () => setIsChargebeeCustomer(v)),
        ]).then((setters) => setters.forEach((s) => s()));
    }, [setCurrency, setIsChargebeeCustomer, setIsStudent]);

    const leftMenu: Entry[] = [
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
    ];

    return (
        <>
            <header className="app-container flex flex-col pt-4 space-y-4" data-analytics='{"button_type":"menu"}'>
                <div className="flex justify-between items-center h-10 mb-3">
                    <div className="flex items-center pr-3">
                        <Link to="/" className="pr-3 w-10">
                            <img src={gitpodIcon} className="h-6" alt="Gitpod's logo" />
                        </Link>
                        <div className="pl-2 text-base text-gray-500 dark:text-gray-400 flex max-w-lg overflow-hidden">
                            {leftMenu.map((entry) => (
                                <div className="p-1" key={entry.title}>
                                    <PillMenuItem
                                        name={entry.title}
                                        selected={isSelected(entry, location)}
                                        link={entry.link}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="flex items-center" id="menu">
                        <OrganizationSelector />
                        <div
                            className="ml-3 flex items-center justify-start mb-0 pointer-cursor m-l-auto rounded-full border-2 border-transparent hover:border-gray-200 dark:hover:border-gray-700 p-0.5 font-medium flex-shrink-0"
                            data-analytics='{"label":"Account"}'
                        >
                            <UserMenu user={user} />
                        </div>
                    </div>
                </div>
            </header>
            <Separator />
        </>
    );
}

type UserMenuProps = {
    user?: User;
};
const UserMenu: FunctionComponent<UserMenuProps> = ({ user }) => {
    const [isFeedbackFormVisible, setFeedbackFormVisible] = useState<boolean>(false);

    const handleFeedbackFormClick = useCallback(() => {
        setFeedbackFormVisible(true);
    }, []);

    const onFeedbackFormClose = useCallback(() => {
        setFeedbackFormVisible(false);
    }, []);

    const entries = useMemo((): ContextMenuEntry[] => {
        return [
            {
                title: (user && (User.getPrimaryEmail(user) || user?.name)) || "User",
                customFontStyle: "text-gray-400",
                separator: true,
            },
            {
                title: "User Settings",
                link: "/user/settings",
            },
            ...(user?.rolesOrPermissions?.includes("admin")
                ? [
                      {
                          title: "Admin",
                          link: "/admin",
                      },
                  ]
                : []),
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
                // ensure separator is last item before logout
                separator: !isGitpodIo(),
            },
            ...(isGitpodIo()
                ? [
                      {
                          title: "Feedback",
                          onClick: handleFeedbackFormClick,
                          separator: true,
                      },
                  ]
                : []),
            {
                title: "Logout",
                href: gitpodHostUrl.asApiLogout().toString(),
            },
        ];
    }, [handleFeedbackFormClick, user]);

    return (
        <>
            <ContextMenu menuEntries={entries}>
                <img className="rounded-full w-6 h-6" src={user?.avatarUrl || ""} alt={user?.name || "Anonymous"} />
            </ContextMenu>
            {isFeedbackFormVisible && <FeedbackFormModal onClose={onFeedbackFormClose} />}
        </>
    );
};
