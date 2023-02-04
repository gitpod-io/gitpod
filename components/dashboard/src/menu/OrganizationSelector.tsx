/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import ContextMenu, { ContextMenuEntry } from "../components/ContextMenu";
import { useCurrentTeam, useTeamMemberInfos, useTeams } from "../teams/teams-context";
import { useCurrentUser } from "../user-context";

export interface OrganizationSelectorProps {}

export default function OrganizationSelector(p: OrganizationSelectorProps) {
    const user = useCurrentUser();
    const teams = useTeams();
    const team = useCurrentTeam();
    const teamMembers = useTeamMemberInfos();
    const location = useLocation();

    const userFullName = user?.fullName || user?.name || "...";
    const entries: ContextMenuEntry[] = useMemo(
        () => [
            ...(!user?.additionalData?.isMigratedToTeamOnlyAttribution
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
                          active: team === undefined,
                          separator: true,
                          link: `${location.pathname}?org=0`,
                      },
                  ]
                : []),
            ...(teams || [])
                .map((t) => ({
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
                    active: team?.id === t.id,
                    separator: true,
                    link: `${location.pathname}?org=${t.id}`,
                }))
                .sort((a, b) => (a.title.toLowerCase() > b.title.toLowerCase() ? 1 : -1)),
            {
                title: "Create a new organization",
                customContent: (
                    <div className="w-full text-gray-400 flex items-center">
                        <span className="flex-1 font-semibold">New Organization</span>
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
                link: "/orgs/new",
            },
        ],
        [
            user?.additionalData?.isMigratedToTeamOnlyAttribution,
            userFullName,
            team,
            location.pathname,
            teams,
            teamMembers,
        ],
    );
    const selectedEntry = entries.find((e) => e.active) || entries[0];
    const classes =
        "flex h-full text-base py-0 text-gray-500 bg-gray-50  dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 dark:border-gray-700";
    return (
        <ContextMenu customClasses="w-64 left-0" menuEntries={entries}>
            <div className={`${classes} rounded-2xl pl-3`}>
                <div className="py-1 pr-2 font-semibold">{selectedEntry.title!}</div>
                <div className="flex h-full pl-0 pr-1 py-1.5 text-gray-50">
                    <svg width="20" height="20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path
                            fillRule="evenodd"
                            clipRule="evenodd"
                            d="M5.293 7.293a1 1 0 0 1 1.414 0L10 10.586l3.293-3.293a1 1 0 1 1 1.414 1.414l-4 4a1 1 0 0 1-1.414 0l-4-4a1 1 0 0 1 0-1.414Z"
                            fill="#78716C"
                        />
                        <title>Toggle organization selection menu</title>
                    </svg>
                </div>
            </div>
        </ContextMenu>
    );
}
