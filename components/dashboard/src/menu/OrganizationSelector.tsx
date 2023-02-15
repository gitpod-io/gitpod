/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FunctionComponent, useMemo } from "react";
import ContextMenu, { ContextMenuEntry } from "../components/ContextMenu";
import { OrgIcon } from "../components/org-icon/OrgIcon";
import { useCurrentTeam, useTeamMemberInfos, useTeams } from "../teams/teams-context";
import { useCurrentOrgMember } from "../data/organizations/org-members-query";
import { useCurrentUser } from "../user-context";
import { BillingMode } from "@gitpod/gitpod-protocol/lib/billing-mode";
import { useUserBillingMode } from "../data/billing-mode/user-billing-mode-query";
import { useOrgBillingMode } from "../data/billing-mode/org-billing-mode-query";
import { useFeatureFlags } from "../contexts/FeatureFlagContext";

export interface OrganizationSelectorProps {}

export default function OrganizationSelector(p: OrganizationSelectorProps) {
    const user = useCurrentUser();
    const teams = useTeams();
    const currentOrg = useCurrentTeam();
    const teamMembers = useTeamMemberInfos();
    const { member: currentOrgMember } = useCurrentOrgMember();
    const { data: userBillingMode } = useUserBillingMode();
    const { data: orgBillingMode } = useOrgBillingMode();
    const { showUsageView } = useFeatureFlags();

    const userFullName = user?.fullName || user?.name || "...";

    const entries: ContextMenuEntry[] = useMemo(() => {
        let activeOrgEntry = !currentOrg
            ? {
                  title: userFullName,
                  customContent: <CurrentOrgEntry title={userFullName} subtitle="Personal Account" />,
                  active: false,
                  separator: false,
                  tight: true,
              }
            : {
                  title: currentOrg.name,
                  customContent: (
                      <CurrentOrgEntry
                          title={currentOrg.name}
                          subtitle={
                              !!teamMembers[currentOrg.id]
                                  ? `${teamMembers[currentOrg.id].length} member${
                                        teamMembers[currentOrg.id].length === 1 ? "" : "s"
                                    }`
                                  : "..."
                          }
                      />
                  ),
                  active: false,
                  separator: false,
                  tight: true,
              };

        const linkEntries: ContextMenuEntry[] = [];

        // Show members if we have an org selected
        if (currentOrg) {
            linkEntries.push({
                title: "Members",
                customContent: <LinkEntry>Members</LinkEntry>,
                active: false,
                separator: true,
                link: "/members",
            });
        }

        // Show usage for personal account if usage based billing enabled for user
        const showUsageForPersonalAccount =
            !currentOrg &&
            BillingMode.showUsageBasedBilling(userBillingMode) &&
            !user?.additionalData?.isMigratedToTeamOnlyAttribution;

        const showUsageForOrg =
            currentOrg &&
            currentOrgMember?.role === "owner" &&
            (orgBillingMode?.mode === "usage-based" || showUsageView);

        if (showUsageForPersonalAccount || showUsageForOrg) {
            linkEntries.push({
                title: "Usage",
                customContent: <LinkEntry>Usage</LinkEntry>,
                active: false,
                separator: false,
                link: "/usage",
            });
        }

        // Show settings if user is an owner of current org
        if (currentOrg && currentOrgMember?.role === "owner") {
            linkEntries.push({
                title: "Settings",
                customContent: <LinkEntry>Settings</LinkEntry>,
                active: false,
                separator: false,
                link: "/settings",
            });
        }

        // Ensure only last link entry has a separator
        linkEntries.forEach((e, idx) => {
            e.separator = idx === linkEntries.length - 1;
        });

        const otherOrgEntries = (teams || [])
            .filter((t) => t.id !== currentOrg?.id)
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((t) => ({
                title: t.name,
                customContent: (
                    <OrgEntry
                        id={t.id}
                        title={t.name}
                        subtitle={
                            !!teamMembers[t.id]
                                ? `${teamMembers[t.id].length} member${teamMembers[t.id].length === 1 ? "" : "s"}`
                                : "..."
                        }
                    />
                ),
                // marking as active for styles
                active: true,
                separator: true,
                link: `/?org=${t.id}`,
            }));

        const userMigrated = user?.additionalData?.isMigratedToTeamOnlyAttribution ?? false;
        const showPersonalEntry = !userMigrated && !!currentOrg;

        return [
            activeOrgEntry,
            ...linkEntries,
            // If user has not been migrated, and isn't currently selected, show personal account
            ...(showPersonalEntry
                ? [
                      {
                          title: userFullName,
                          customContent: (
                              <OrgEntry id={user?.id ?? "self"} title={userFullName} subtitle="Personal Account" />
                          ),
                          // marking as active for styles
                          active: true,
                          separator: true,
                          link: `/?org=0`,
                      },
                  ]
                : []),
            ...otherOrgEntries,
            {
                title: "Create a new organization",
                customContent: (
                    <div className="w-full text-gray-500 flex items-center">
                        <span className="flex-1">New Organization</span>
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
                // marking as active for styles
                active: true,
            },
        ];
    }, [
        currentOrg,
        userFullName,
        user?.id,
        user?.additionalData?.isMigratedToTeamOnlyAttribution,
        teamMembers,
        userBillingMode,
        showUsageView,
        currentOrgMember?.role,
        orgBillingMode?.mode,
        teams,
    ]);

    const selectedTitle = currentOrg ? currentOrg.name : userFullName;
    const classes =
        "flex h-full text-base py-0 text-gray-500 bg-gray-50  dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 dark:border-gray-700";
    return (
        <ContextMenu customClasses="w-64 left-0" menuEntries={entries}>
            <div className={`${classes} rounded-2xl pl-1`}>
                <div className="py-1 pr-1 flex font-semibold whitespace-nowrap max-w-xs overflow-hidden">
                    <OrgIcon
                        id={currentOrg?.id || user?.id || "empty"}
                        name={selectedTitle}
                        size="small"
                        className="mr-2"
                    />
                    {selectedTitle}
                </div>
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

const LinkEntry: FunctionComponent = ({ children }) => {
    return (
        <div className="w-full text-sm text-gray-500 dark:text-gray-400">
            <span>{children}</span>
        </div>
    );
};

type OrgEntryProps = {
    id: string;
    title: string;
    subtitle: string;
};
const OrgEntry: FunctionComponent<OrgEntryProps> = ({ id, title, subtitle }) => {
    return (
        <div className="w-full text-gray-400 flex items-center">
            <OrgIcon id={id} name={title} className="mr-4" />
            <div className="flex flex-col">
                <span className="text-gray-800 dark:text-gray-300 text-base font-semibold">{title}</span>
                <span>{subtitle}</span>
            </div>
        </div>
    );
};

type CurrentOrgEntryProps = {
    title: string;
    subtitle: string;
};
const CurrentOrgEntry: FunctionComponent<CurrentOrgEntryProps> = ({ title, subtitle }) => {
    return (
        <div className="w-full text-gray-400 flex items-center justify-between">
            <div className="flex flex-col">
                <span className="text-gray-800 dark:text-gray-300 text-base font-semibold">{title}</span>
                <span>{subtitle}</span>
            </div>
            {/* TODO: Replace this with an SVG icon */}
            <div className="pl-1 font-semibold">&#x2713;</div>
        </div>
    );
};
