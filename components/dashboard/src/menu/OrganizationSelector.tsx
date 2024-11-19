/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FunctionComponent, useCallback } from "react";
import ContextMenu, { ContextMenuEntry } from "../components/ContextMenu";
import { OrgIcon, OrgIconProps } from "../components/org-icon/OrgIcon";
import { useCurrentUser } from "../user-context";
import { useCurrentOrg, useOrganizations } from "../data/organizations/orgs-query";
import { useLocation } from "react-router";
import { useOrgBillingMode } from "../data/billing-mode/org-billing-mode-query";
import { useFeatureFlag } from "../data/featureflag-query";
import { useIsOwner, useListOrganizationMembers, useHasRolePermission } from "../data/organizations/members-query";
import { isOrganizationOwned } from "@gitpod/public-api-common/lib/user-utils";
import { OrganizationRole } from "@gitpod/public-api/lib/gitpod/v1/organization_pb";

export default function OrganizationSelector() {
    const user = useCurrentUser();
    const orgs = useOrganizations();
    const currentOrg = useCurrentOrg();
    const members = useListOrganizationMembers().data ?? [];
    const owner = useIsOwner();
    const hasMemberPermission = useHasRolePermission(OrganizationRole.MEMBER);
    const { data: billingMode } = useOrgBillingMode();
    const getOrgURL = useGetOrgURL();
    const isDedicated = useFeatureFlag("enableDedicatedOnboardingFlow");

    // we should have an API to ask for permissions, until then we duplicate the logic here
    const canCreateOrgs = user && !isOrganizationOwned(user) && !isDedicated;

    const userFullName = user?.name || "...";

    const activeOrgEntry = !currentOrg.data
        ? {
              title: userFullName,
              customContent: <CurrentOrgEntry title={userFullName} subtitle="Personal Account" />,
              active: false,
              separator: false,
              tight: true,
          }
        : {
              title: currentOrg.data.name,
              customContent: (
                  <CurrentOrgEntry
                      title={currentOrg.data.name}
                      subtitle={hasMemberPermission ? `${members.length} member${members.length === 1 ? "" : "s"}` : ""}
                  />
              ),
              active: false,
              separator: false,
              tight: true,
          };

    const linkEntries: ContextMenuEntry[] = [];

    // Show members if we have an org selected
    if (currentOrg.data) {
        // collaborator can't access projects, members, usage and billing
        if (hasMemberPermission) {
            linkEntries.push({
                title: "Prebuilds",
                customContent: <LinkEntry>Prebuilds</LinkEntry>,
                active: false,
                separator: false,
                link: "/prebuilds",
            });
            linkEntries.push({
                title: "Members",
                customContent: <LinkEntry>Members</LinkEntry>,
                active: false,
                separator: true,
                link: "/members",
            });
            linkEntries.push({
                title: "Usage",
                customContent: <LinkEntry>Usage</LinkEntry>,
                active: false,
                separator: false,
                link: "/usage",
            });
            // Show billing if user is an owner of current org
            if (owner) {
                if (billingMode?.mode === "usage-based") {
                    linkEntries.push({
                        title: "Billing",
                        customContent: <LinkEntry>Billing</LinkEntry>,
                        active: false,
                        separator: false,
                        link: "/billing",
                    });
                }
            }

            linkEntries.push({
                title: "Repository Settings",
                customContent: <LinkEntry>Repository Settings</LinkEntry>,
                active: false,
                separator: false,
                link: "/repositories",
            });

            // Org settings is available for all members, but only owner can change them
            // collaborator can read org setting via API so that other feature like restrict org workspace classes could work
            // we only hide the menu from dashboard
            linkEntries.push({
                title: "Organization Settings",
                customContent: <LinkEntry>Organization Settings</LinkEntry>,
                active: false,
                separator: false,
                link: "/settings",
            });
        }
    }

    // Ensure only last link entry has a separator
    linkEntries.forEach((e, idx) => {
        e.separator = idx === linkEntries.length - 1;
    });

    const otherOrgEntries = (orgs.data || [])
        .filter((org) => org.id !== currentOrg.data?.id)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((org) => ({
            title: org.name,
            customContent: <OrgEntry id={org.id} title={org.name} subtitle={""} />,
            // marking as active for styles
            active: true,
            separator: true,
            link: getOrgURL(org.id),
        }));

    const entries = [
        activeOrgEntry,
        ...linkEntries,
        ...otherOrgEntries,
        ...(canCreateOrgs
            ? [
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
              ]
            : []),
    ];

    const selectedTitle = currentOrg?.data ? currentOrg.data.name : userFullName;
    const classes =
        "flex h-full text-base py-0 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700";
    return (
        <ContextMenu customClasses="w-64 left-0 text-left" menuEntries={entries}>
            <div className={`${classes} rounded-2xl pl-1`}>
                <div className="py-1 pr-1 flex font-medium max-w-xs truncate">
                    <OrgIcon
                        id={currentOrg?.data?.id || user?.id || "empty"}
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
    iconSize?: OrgIconProps["size"];
};
export const OrgEntry: FunctionComponent<OrgEntryProps> = ({ id, title, subtitle, iconSize }) => {
    return (
        <div className="w-full text-gray-400 flex items-center">
            <OrgIcon id={id} name={title} className="mr-4" size={iconSize} />
            <div className="flex flex-col">
                <span className="text-gray-800 dark:text-gray-300 text-base font-semibold truncate w-40">{title}</span>
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
                <span className="text-gray-800 dark:text-gray-300 text-base font-semibold truncate w-40">{title}</span>
                <span>{subtitle}</span>
            </div>

            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" className="dark:hidden" fill="none">
                <path
                    fill="#78716C"
                    fillRule="evenodd"
                    d="M18.2348 5.8867 7.88699 16.2345l-2.12132-2.1213L16.1135 3.76538l2.1213 2.12132Z"
                    clipRule="evenodd"
                />
                <path
                    fill="#78716C"
                    fillRule="evenodd"
                    d="m3.88695 8.06069 5.00004 5.00001-2.12132 2.1214-5.00005-5.0001 2.12133-2.12131Z"
                    clipRule="evenodd"
                />
            </svg>

            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" className="hidden dark:block" fill="none">
                <path
                    fill="#E7E5E4"
                    fillRule="evenodd"
                    d="M18.2348 5.8867 7.88699 16.2345l-2.12132-2.1213L16.1135 3.76538l2.1213 2.12132Z"
                    clipRule="evenodd"
                />
                <path
                    fill="#E7E5E4"
                    fillRule="evenodd"
                    d="m3.88695 8.06069 5.00004 5.00001-2.12132 2.1214-5.00005-5.0001 2.12133-2.12131Z"
                    clipRule="evenodd"
                />
            </svg>
        </div>
    );
};

// Determine url to use when switching orgs
// Maintains the current location & context url (hash) when on the new workspace page
const useGetOrgURL = () => {
    const location = useLocation();

    return useCallback(
        (orgID: string) => {
            // Default to root path when switching orgs
            let path = "/";
            let hash = "";
            const search = new URLSearchParams();
            search.append("org", orgID);

            // If we're on the new workspace page, try to maintain the location and context url
            if (/^\/new(\/$)?$/.test(location.pathname)) {
                path = `/new`;
                hash = location.hash;
                search.append("autostart", "false");
            }

            return `${path}?${search.toString()}${hash}`;
        },
        [location.hash, location.pathname],
    );
};
