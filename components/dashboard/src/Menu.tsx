/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { User, TeamMemberInfo, Project } from "@gitpod/gitpod-protocol";
import { useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useLocation, useRouteMatch } from "react-router";
import { Location } from "history";
import { countries } from "countries-list";
import gitpodIcon from "./icons/gitpod.svg";
import { getGitpodService, gitpodHostUrl } from "./service/service";
import { UserContext } from "./user-context";
import { TeamsContext, getCurrentTeam, getSelectedTeamSlug } from "./teams/teams-context";
import { getAdminMenu } from "./admin/admin-menu";
import ContextMenu, { ContextMenuEntry } from "./components/ContextMenu";
import Separator from "./components/Separator";
import PillMenuItem from "./components/PillMenuItem";
import TabMenuItem from "./components/TabMenuItem";
import { getTeamSettingsMenu } from "./teams/TeamSettings";
import { getProjectSettingsMenu } from "./projects/ProjectSettings";
import { ProjectContext } from "./projects/project-context";
import { PaymentContext } from "./payment-context";
import FeedbackFormModal from "./feedback-form/FeedbackModal";
import { inResource, isGitpodIo } from "./utils";
import { BillingMode } from "@gitpod/gitpod-protocol/lib/billing-mode";
import { FeatureFlagContext } from "./contexts/FeatureFlagContext";
import { publicApiTeamMembersToProtocol, teamsService } from "./service/public-api";
import { listAllProjects } from "./service/public-api";

interface Entry {
    title: string;
    link: string;
    alternatives?: string[];
}

export default function Menu() {
    const { user } = useContext(UserContext);
    const { showUsageView, usePublicApiTeamsService, usePublicApiProjectsService } = useContext(FeatureFlagContext);
    const { teams } = useContext(TeamsContext);
    const location = useLocation();
    const team = getCurrentTeam(location, teams);
    const { setCurrency, setIsStudent, setIsChargebeeCustomer } = useContext(PaymentContext);
    const [teamBillingMode, setTeamBillingMode] = useState<BillingMode | undefined>(undefined);
    const [userBillingMode, setUserBillingMode] = useState<BillingMode | undefined>(undefined);
    const { project, setProject } = useContext(ProjectContext);
    const [isFeedbackFormVisible, setFeedbackFormVisible] = useState<boolean>(false);

    const [hasIndividualProjects, setHasIndividualProjects] = useState(false);

    useEffect(() => {
        getGitpodService()
            .server.getUserProjects()
            .then((projects) => setHasIndividualProjects(projects.length > 0));
        getGitpodService().server.getBillingModeForUser().then(setUserBillingMode);
    }, []);

    const teamRouteMatch = useRouteMatch<{ segment1?: string; segment2?: string; segment3?: string }>(
        "/t/:segment1/:segment2?/:segment3?",
    );

    // TODO: Remove it after remove projects under personal accounts
    const projectsRouteMatch = useRouteMatch<{ segment1?: string; segment2?: string }>(
        "/projects/:segment1?/:segment2?",
    );

    const projectSlug = (() => {
        const resource = teamRouteMatch?.params?.segment2 || projectsRouteMatch?.params.segment1;
        if (
            resource &&
            ![
                // team sub-pages
                "projects",
                "members",
                "settings",
                "billing",
                "usage",
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
        const resource = projectSlug && (teamRouteMatch?.params?.segment3 || projectsRouteMatch?.params.segment2);
        if (
            resource &&
            ![
                // project sub-pages
                "prebuilds",
                "settings",
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

    // Hide most of the top menu when in a full-page form.
    const isMinimalUI = inResource(location.pathname, ["new", "teams/new", "open"]);
    const isWorkspacesUI = inResource(location.pathname, ["workspaces"]);
    const isPersonalSettingsUI = inResource(location.pathname, [
        "account",
        "notifications",
        "billing",
        "usage",
        "plans",
        "teams",
        "variables",
        "keys",
        "integrations",
        "preferences",
        "tokens",
    ]);
    const isAdminUI = inResource(window.location.pathname, ["admin"]);

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
                        members[team.id] = usePublicApiTeamsService
                            ? await publicApiTeamMembersToProtocol(
                                  (await teamsService.getTeam({ teamId: team!.id })).team?.members || [],
                              )
                            : await getGitpodService().server.getTeamMembers(team.id);
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
            let projects: Project[];
            if (!!team) {
                projects = usePublicApiProjectsService
                    ? await listAllProjects({ teamId: team.id })
                    : await getGitpodService().server.getTeamProjects(team.id);
            } else {
                projects = usePublicApiProjectsService
                    ? await listAllProjects({ userId: user?.id })
                    : await getGitpodService().server.getUserProjects();
            }

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
            server.getClientRegion().then((v) => () => {
                // @ts-ignore
                setCurrency(countries[v]?.currency === "EUR" ? "EUR" : "USD");
            }),
            server.isStudent().then((v) => () => setIsStudent(v)),
            server.isChargebeeCustomer().then((v) => () => setIsChargebeeCustomer(v)),
        ]).then((setters) => setters.forEach((s) => s()));
    }, []);

    useEffect(() => {
        if (team) {
            getGitpodService().server.getBillingModeForTeam(team.id).then(setTeamBillingMode);
        }
    }, [team]);

    const teamOrUserSlug = !!team ? "/t/" + team.slug : "/projects";
    const secondLevelMenu: Entry[] = (() => {
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
        if (!team) {
            return [];
        }
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
        if (
            currentUserInTeam?.role === "owner" &&
            (showUsageView || (teamBillingMode && teamBillingMode.mode === "usage-based"))
        ) {
            teamSettingsList.push({
                title: "Usage",
                link: `/t/${team.slug}/usage`,
            });
        }
        if (currentUserInTeam?.role === "owner") {
            teamSettingsList.push({
                title: "Settings",
                link: `/t/${team.slug}/settings`,
                alternatives: getTeamSettingsMenu({ team, billingMode: teamBillingMode }).flatMap((e) => e.link),
            });
        }

        return teamSettingsList;
    })();
    const leftMenu: Entry[] = [
        {
            title: "Workspaces",
            link: "/workspaces",
            alternatives: ["/"],
        },
    ];
    const rightMenu: Entry[] = [
        ...(user?.rolesOrPermissions?.includes("admin")
            ? [
                  {
                      title: "Admin",
                      link: "/admin",
                      alternatives: getAdminMenu().flatMap((e) => e.link),
                  },
              ]
            : []),
    ];

    const handleFeedbackFormClick = () => {
        setFeedbackFormVisible(true);
    };

    const onFeedbackFormClose = () => {
        setFeedbackFormVisible(false);
    };
    const isTeamLevelActive = !projectSlug && !isWorkspacesUI && !isPersonalSettingsUI && !isAdminUI && teamOrUserSlug;
    const renderTeamMenu = () => {
        if (!hasIndividualProjects && (!teams || teams.length === 0)) {
            return (
                <div className="p-1 text-base text-gray-500 dark:text-gray-400 border-gray-800">
                    <PillMenuItem
                        additionalClasses="border-2 border-gray-200 dark:border-gray-700 border-dashed"
                        name="New Team →"
                        link="/teams/new"
                    />
                </div>
            );
        }
        const userFullName = user?.fullName || user?.name || "...";
        const entries: (ContextMenuEntry & { slug: string })[] = [
            ...(hasIndividualProjects
                ? [
                      {
                          title: userFullName,
                          customContent: (
                              <div className="w-full text-gray-500 flex flex-col">
                                  <span className="text-gray-800 dark:text-gray-100 text-base font-semibold">
                                      {userFullName}
                                  </span>
                                  <span className="">Personal Account</span>
                              </div>
                          ),
                          active: getSelectedTeamSlug() === "",
                          separator: true,
                          slug: "",
                          link: "/projects",
                      },
                  ]
                : []),
            ...(teams || [])
                .map((t) => ({
                    slug: t.slug,
                    title: t.name,
                    customContent: (
                        <div className="w-full text-gray-400 flex flex-col">
                            <span className="text-gray-800 dark:text-gray-300 text-base font-semibold">{t.name}</span>
                            <span className="">
                                {!!teamMembers[t.id]
                                    ? `${teamMembers[t.id].length} member${teamMembers[t.id].length === 1 ? "" : "s"}`
                                    : "..."}
                            </span>
                        </div>
                    ),
                    active: getSelectedTeamSlug() === t.slug,
                    separator: true,
                    link: `/t/${t.slug}`,
                }))
                .sort((a, b) => (a.title.toLowerCase() > b.title.toLowerCase() ? 1 : -1)),
            {
                slug: "new",
                title: "Create a new team",
                customContent: (
                    <div className="w-full text-gray-400 flex items-center">
                        <span className="flex-1 font-semibold">New Team</span>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14" className="w-3.5">
                            <path
                                fill="currentColor"
                                fillRule="evenodd"
                                d="M7 0a1 1 0 011 1v5h5a1 1 0 110 2H8v5a1 1 0 11-2 0V8H1a1 1 0 010-2h5V1a1 1 0 011-1z"
                                clipRule="evenodd"
                            />
                        </svg>
                    </div>
                ),
                link: "/teams/new",
            },
        ];
        const classes =
            "flex h-full text-base py-0 " +
            (isTeamLevelActive
                ? "text-gray-50  bg-gray-800 dark:bg-gray-50  dark:text-gray-900 border-gray-700 dark:border-gray-200"
                : "text-gray-500 bg-gray-50  dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 dark:border-gray-700");
        const selectedEntry = entries.find((e) => e.slug === getSelectedTeamSlug()) || entries[0];
        return (
            <div className="flex p-1">
                <Link to={selectedEntry.link!}>
                    <span className={`${classes} rounded-tl-2xl rounded-bl-2xl border-r pl-3 pr-2 py-1 font-semibold`}>
                        {selectedEntry.title!}
                    </span>
                </Link>
                <div className={`${classes} rounded-tr-2xl rounded-br-2xl px-1`}>
                    <ContextMenu customClasses="w-64 left-0" menuEntries={entries}>
                        <div className="flex h-full pl-0 pr-1 py-1.5 text-gray-50">
                            <svg width="20" height="20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path
                                    fillRule="evenodd"
                                    clipRule="evenodd"
                                    d="M5.293 7.293a1 1 0 0 1 1.414 0L10 10.586l3.293-3.293a1 1 0 1 1 1.414 1.414l-4 4a1 1 0 0 1-1.414 0l-4-4a1 1 0 0 1 0-1.414Z"
                                    fill="#78716C"
                                />
                                <title>Toggle team selection menu</title>
                            </svg>
                        </div>
                    </ContextMenu>
                </div>
                {projectSlug && !prebuildId && !isAdminUI && (
                    <Link to={`${teamOrUserSlug}/${projectSlug}${prebuildId ? "/prebuilds" : ""}`}>
                        <span className=" flex h-full text-base text-gray-50 bg-gray-800 dark:bg-gray-50 dark:text-gray-900 font-semibold ml-2 px-3 py-1 rounded-2xl border-gray-100">
                            {project?.name}
                        </span>
                    </Link>
                )}
                {prebuildId && (
                    <Link to={`${teamOrUserSlug}/${projectSlug}${prebuildId ? "/prebuilds" : ""}`}>
                        <span className=" flex h-full text-base text-gray-500 bg-gray-50 hover:bg-gray-100 dark:text-gray-400 dark:bg-gray-800 dark:hover:bg-gray-700 font-semibold ml-2 px-3 py-1 rounded-2xl border-gray-100">
                            {project?.name}
                        </span>
                    </Link>
                )}
                {prebuildId && (
                    <div className="flex ml-2">
                        <div className="flex pl-0 pr-1 py-1.5">
                            <svg width="20" height="20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path
                                    fillRule="evenodd"
                                    clipRule="evenodd"
                                    d="M7.293 14.707a1 1 0 0 1 0-1.414L10.586 10 7.293 6.707a1 1 0 1 1 1.414-1.414l4 4a1 1 0 0 1 0 1.414l-4 4a1 1 0 0 1-1.414 0Z"
                                    fill="#78716C"
                                />
                            </svg>
                        </div>
                        <Link to={`${teamOrUserSlug}/${projectSlug}/${prebuildId}`}>
                            <span className="flex h-full text-base text-gray-50 bg-gray-800 dark:bg-gray-50 dark:text-gray-900 font-semibold px-3 py-1 rounded-2xl border-gray-100">
                                {prebuildId.substring(0, 8).trimEnd()}
                            </span>
                        </Link>
                    </div>
                )}
            </div>
        );
    };

    return (
        <>
            <header className="app-container flex flex-col pt-4 space-y-4" data-analytics='{"button_type":"menu"}'>
                <div className="flex h-10 mb-3">
                    <div className="flex justify-between items-center pr-3">
                        <Link to="/">
                            <img src={gitpodIcon} className="h-6" alt="Gitpod's logo" />
                        </Link>
                        {!isMinimalUI && (
                            <>
                                <div className="pl-2 text-base text-gray-500 dark:text-gray-400 flex">
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
                                {renderTeamMenu()}
                            </>
                        )}
                    </div>
                    <div className="flex flex-1 items-center w-auto" id="menu">
                        <nav className="flex-1">
                            <ul className="flex flex-1 items-center justify-between text-base text-gray-500 dark:text-gray-400 space-x-2">
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
                                {isGitpodIo() && (
                                    <li className="cursor-pointer">
                                        <PillMenuItem name="Feedback" onClick={handleFeedbackFormClick} />
                                    </li>
                                )}
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
                                    ...(BillingMode.showUsageBasedBilling(userBillingMode)
                                        ? [
                                              {
                                                  title: "Usage",
                                                  link: "/usage",
                                              },
                                          ]
                                        : []),
                                    {
                                        title: "Docs",
                                        href: "https://www.gitpod.io/docs/",
                                    },
                                    {
                                        title: "Help",
                                        href: "https://www.gitpod.io/support/",
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
                {!isMinimalUI && !prebuildId && !isWorkspacesUI && !isPersonalSettingsUI && !isAdminUI && (
                    <nav className="flex">
                        {secondLevelMenu.map((entry: Entry) => (
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
