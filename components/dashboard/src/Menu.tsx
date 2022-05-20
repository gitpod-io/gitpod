/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { User, TeamMemberInfo, Project } from "@gitpod/gitpod-protocol";
import { useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useLocation, useRouteMatch } from "react-router";
import { Location } from "history";
import { countries } from "countries-list";
import gitpodIcon from "./icons/gitpod.svg";
import CaretDown from "./icons/CaretDown.svg";
import CaretUpDown from "./icons/CaretUpDown.svg";
import { getGitpodService, gitpodHostUrl } from "./service/service";
import { UserContext } from "./user-context";
import { TeamsContext, getCurrentTeam } from "./teams/teams-context";
import getSettingsMenu from "./settings/settings-menu";
import { adminMenu } from "./admin/admin-menu";
import ContextMenu from "./components/ContextMenu";
import Separator from "./components/Separator";
import PillMenuItem from "./components/PillMenuItem";
import TabMenuItem from "./components/TabMenuItem";
import { getTeamSettingsMenu } from "./teams/TeamSettings";
import { getProjectSettingsMenu } from "./projects/ProjectSettings";
import { ProjectContext } from "./projects/project-context";
import { PaymentContext } from "./payment-context";
import FeedbackFormModal from "./feedback-form/FeedbackModal";

interface Entry {
    title: string;
    link: string;
    alternatives?: string[];
}

export default function Menu() {
    const { user } = useContext(UserContext);
    const { teams } = useContext(TeamsContext);
    const location = useLocation();
    const team = getCurrentTeam(location, teams);
    const { showPaymentUI, setShowPaymentUI, setCurrency, setIsStudent, setIsChargebeeCustomer } =
        useContext(PaymentContext);
    const { project, setProject } = useContext(ProjectContext);
    const [isFeedbackFormVisible, setFeedbackFormVisible] = useState<boolean>(false);

    const match = useRouteMatch<{ segment1?: string; segment2?: string; segment3?: string }>(
        "/(t/)?:segment1/:segment2?/:segment3?",
    );
    const projectSlug = (() => {
        const resource = match?.params?.segment2;
        if (
            resource &&
            ![
                // team sub-pages
                "projects",
                "members",
                "settings",
                "billing",
                // admin sub-pages
                "users",
                "workspaces",
                "teams",
            ].includes(resource)
        ) {
            return resource;
        }
    })();
    const prebuildId = (() => {
        const resource = projectSlug && match?.params?.segment3;
        if (
            resource &&
            ![
                // project sub-pages
                "prebuilds",
                "settings",
                "configure",
                "variables",
            ].includes(resource)
        ) {
            return resource;
        }
    })();

    function isSelected(entry: Entry, location: Location<any>) {
        const all = [entry.link, ...(entry.alternatives || [])].map((l) => l.toLowerCase());
        const path = location.pathname.toLowerCase();
        return all.some((n) => n === path || n + "/" === path);
    }

    const userFullName = user?.fullName || user?.name || "...";

    {
        // updating last team selection
        try {
            localStorage.setItem("team-selection", team ? team.slug : "");
        } catch {}
    }

    // Hide most of the top menu when in a full-page form.
    const isMinimalUI = ["/new", "/teams/new", "/open"].includes(location.pathname);

    const [teamMembers, setTeamMembers] = useState<Record<string, TeamMemberInfo[]>>({});
    useEffect(() => {
        if (!teams) {
            return;
        }
        (async () => {
            const members: Record<string, TeamMemberInfo[]> = {};
            await Promise.all(
                teams.map(async (team) => {
                    try {
                        members[team.id] = await getGitpodService().server.getTeamMembers(team.id);
                    } catch (error) {
                        console.error("Could not get members of team", team, error);
                    }
                }),
            );
            setTeamMembers(members);
        })();
    }, [teams]);

    useEffect(() => {
        if (!teams || !projectSlug) {
            return;
        }
        (async () => {
            const projects = !!team
                ? await getGitpodService().server.getTeamProjects(team.id)
                : await getGitpodService().server.getUserProjects();

            // Find project matching with slug, otherwise with name
            const project =
                projectSlug && projects.find((p) => (p.slug ? p.slug === projectSlug : p.name === projectSlug));
            if (!project) {
                return;
            }
            setProject(project);
        })();
    }, [projectSlug, setProject, team, teams]);

    useEffect(() => {
        const { server } = getGitpodService();
        Promise.all([
            server.getShowPaymentUI().then((v) => () => setShowPaymentUI(v)),
            server.getClientRegion().then((v) => () => {
                // @ts-ignore
                setCurrency(countries[v]?.currency === "EUR" ? "EUR" : "USD");
            }),
            server.isStudent().then((v) => () => setIsStudent(v)),
            server.isChargebeeCustomer().then((v) => () => setIsChargebeeCustomer(v)),
        ]).then((setters) => setters.forEach((s) => s()));
    }, []);

    const teamOrUserSlug = !!team ? "/t/" + team.slug : "/projects";
    const leftMenu: Entry[] = (() => {
        // Project menu
        if (projectSlug) {
            return [
                {
                    title: "Branches",
                    link: `${teamOrUserSlug}/${projectSlug}`,
                },
                {
                    title: "Prebuilds",
                    link: `${teamOrUserSlug}/${projectSlug}/prebuilds`,
                },
                {
                    title: "Settings",
                    link: `${teamOrUserSlug}/${projectSlug}/settings`,
                    alternatives: getProjectSettingsMenu({ slug: projectSlug } as Project, team).flatMap((e) => e.link),
                },
            ];
        }
        // Team menu
        if (team) {
            const currentUserInTeam = (teamMembers[team.id] || []).find((m) => m.userId === user?.id);

            const teamSettingsList = [
                {
                    title: "Projects",
                    link: `/t/${team.slug}/projects`,
                    alternatives: [] as string[],
                },
                {
                    title: "Members",
                    link: `/t/${team.slug}/members`,
                },
            ];
            if (currentUserInTeam?.role === "owner") {
                teamSettingsList.push({
                    title: "Settings",
                    link: `/t/${team.slug}/settings`,
                    alternatives: getTeamSettingsMenu({ team, showPaymentUI }).flatMap((e) => e.link),
                });
            }

            return teamSettingsList;
        }
        // User menu
        return [
            {
                title: "Workspaces",
                link: "/workspaces",
                alternatives: ["/"],
            },
            {
                title: "Projects",
                link: "/projects",
            },
            {
                title: "Settings",
                link: "/settings",
                alternatives: getSettingsMenu({ showPaymentUI }).flatMap((e) => e.link),
            },
        ];
    })();
    const rightMenu: Entry[] = [
        ...(user?.rolesOrPermissions?.includes("admin")
            ? [
                  {
                      title: "Admin",
                      link: "/admin",
                      alternatives: adminMenu.flatMap((e) => e.link),
                  },
              ]
            : []),
        {
            title: "Docs",
            link: "https://www.gitpod.io/docs/",
        },
    ];

    const handleFeedbackFormClick = () => {
        setFeedbackFormVisible(true);
    };

    const onFeedbackFormClose = () => {
        setFeedbackFormVisible(false);
    };
    const renderTeamMenu = () => {
        return (
            <div className="flex p-1 pl-3 ">
                {projectSlug && (
                    <div className="flex h-full rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 px-2 py-1">
                        <Link to={team ? `/t/${team.slug}/projects` : `/projects`}>
                            <span className="text-base text-gray-600 dark:text-gray-400 font-semibold">
                                {team?.name || userFullName}
                            </span>
                        </Link>
                    </div>
                )}
                <div className="flex h-full rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                    <ContextMenu
                        classes="w-64 left-0"
                        menuEntries={[
                            {
                                title: userFullName,
                                customContent: (
                                    <div className="w-full text-gray-400 flex flex-col">
                                        <span className="text-gray-800 dark:text-gray-100 text-base font-semibold">
                                            {userFullName}
                                        </span>
                                        <span className="">Personal Account</span>
                                    </div>
                                ),
                                active: !team,
                                separator: true,
                                link: "/",
                            },
                            ...(teams || [])
                                .map((t) => ({
                                    title: t.name,
                                    customContent: (
                                        <div className="w-full text-gray-400 flex flex-col">
                                            <span className="text-gray-800 dark:text-gray-300 text-base font-semibold">
                                                {t.name}
                                            </span>
                                            <span className="">
                                                {!!teamMembers[t.id]
                                                    ? `${teamMembers[t.id].length} member${
                                                          teamMembers[t.id].length === 1 ? "" : "s"
                                                      }`
                                                    : "..."}
                                            </span>
                                        </div>
                                    ),
                                    active: team && team.id === t.id,
                                    separator: true,
                                    link: `/t/${t.slug}`,
                                }))
                                .sort((a, b) => (a.title.toLowerCase() > b.title.toLowerCase() ? 1 : -1)),
                            {
                                title: "Create a new team",
                                customContent: (
                                    <div className="w-full text-gray-400 flex items-center">
                                        <span className="flex-1 font-semibold">New Team</span>
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            fill="none"
                                            viewBox="0 0 14 14"
                                            className="w-3.5"
                                        >
                                            <path
                                                fill="currentColor"
                                                fill-rule="evenodd"
                                                d="M7 0a1 1 0 011 1v5h5a1 1 0 110 2H8v5a1 1 0 11-2 0V8H1a1 1 0 010-2h5V1a1 1 0 011-1z"
                                                clip-rule="evenodd"
                                            />
                                        </svg>
                                    </div>
                                ),
                                link: "/teams/new",
                            },
                        ]}
                    >
                        <div className="flex h-full px-2 py-1 space-x-3.5">
                            {!projectSlug && (
                                <span className="text-base text-gray-600 dark:text-gray-400 font-semibold">
                                    {team?.name || userFullName}
                                </span>
                            )}
                            <img
                                alt=""
                                aria-label="Toggle team selection menu"
                                className="filter-grayscale"
                                style={{ marginTop: 5, marginBottom: 5 }}
                                src={CaretUpDown}
                            />
                        </div>
                    </ContextMenu>
                </div>
                {projectSlug && (
                    <div className="flex h-full rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 px-2 py-1">
                        <Link to={`${teamOrUserSlug}/${projectSlug}${prebuildId ? "/prebuilds" : ""}`}>
                            <span className="text-base text-gray-600 dark:text-gray-400 font-semibold">
                                {project?.name}
                            </span>
                        </Link>
                    </div>
                )}
                {prebuildId && (
                    <div className="flex h-full ml-2 py-1">
                        <img alt="" className="mr-3 filter-grayscale m-auto transform -rotate-90" src={CaretDown} />
                        <span className="text-base text-gray-600 dark:text-gray-400 font-semibold">{prebuildId}</span>
                    </div>
                )}
            </div>
        );
    };

    return (
        <>
            <header
                className={`app-container flex flex-col pt-4 space-y-4 ${isMinimalUI || !!prebuildId ? "pb-4" : ""}`}
                data-analytics='{"button_type":"menu"}'
            >
                <div className="flex h-10">
                    <div className="flex justify-between items-center pr-3">
                        <Link to="/">
                            <img src={gitpodIcon} className="h-6" alt="Gitpod's logo" />
                        </Link>
                        {!isMinimalUI && <div className="ml-2 text-base">{renderTeamMenu()}</div>}
                    </div>
                    <div className="flex flex-1 items-center w-auto" id="menu">
                        <nav className="flex-1">
                            <ul className="flex flex-1 items-center justify-between text-base text-gray-700 space-x-2">
                                <li className="flex-1"></li>
                                {!isMinimalUI &&
                                    rightMenu.map((entry) => (
                                        <li key={entry.title}>
                                            <PillMenuItem
                                                name={entry.title}
                                                selected={isSelected(entry, location)}
                                                link={entry.link}
                                            />
                                        </li>
                                    ))}
                                <li className="cursor-pointer">
                                    <PillMenuItem name="Feedback" onClick={handleFeedbackFormClick} />
                                </li>
                            </ul>
                        </nav>
                        <div
                            className="ml-3 flex items-center justify-start mb-0 pointer-cursor m-l-auto rounded-full border-2 border-transparent hover:border-gray-200 dark:hover:border-gray-700 p-0.5 font-medium"
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
                                        title: "Settings",
                                        link: "/settings",
                                    },
                                    {
                                        title: "Help",
                                        link: "https://www.gitpod.io/support",
                                        separator: true,
                                    },
                                    {
                                        title: "Logout",
                                        href: gitpodHostUrl.asApiLogout().toString(),
                                    },
                                ]}
                            >
                                <img
                                    className="rounded-full w-6 h-6"
                                    src={user?.avatarUrl || ""}
                                    alt={user?.name || "Anonymous"}
                                />
                            </ContextMenu>
                        </div>
                    </div>
                    {isFeedbackFormVisible && <FeedbackFormModal onClose={onFeedbackFormClose} />}
                </div>
                {!isMinimalUI && !prebuildId && (
                    <nav className="flex">
                        {leftMenu.map((entry: Entry) => (
                            <TabMenuItem
                                key={entry.title}
                                name={entry.title}
                                selected={isSelected(entry, location)}
                                link={entry.link}
                            />
                        ))}
                    </nav>
                )}
            </header>
            <Separator />
        </>
    );
}
