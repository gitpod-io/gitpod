/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useMemo } from "react";
import { Redirect } from "react-router";
import Header from "../components/Header";
import { SpinnerLoader } from "../components/Loader";
import { PageWithSubMenu } from "../components/PageWithSubMenu";
import { useFeatureFlags } from "../contexts/FeatureFlagContext";
import { useOrgBillingMode } from "../data/billing-mode/org-billing-mode-query";
import { useCurrentOrgMember } from "../data/organizations/org-members-query";
import { useCurrentTeam } from "./teams-context";
import { getTeamSettingsMenu } from "./TeamSettings";

export interface OrgSettingsPageProps {
    children: React.ReactNode;
}

export function OrgSettingsPage({ children }: OrgSettingsPageProps) {
    const team = useCurrentTeam();
    const { data: teamBillingMode, isLoading: isBillingModeLoading } = useOrgBillingMode();
    const { isOwner, isLoading: isMemberInfoLoading } = useCurrentOrgMember();
    const { oidcServiceEnabled, orgGitAuthProviders } = useFeatureFlags();

    const isLoading = useMemo(
        () => isBillingModeLoading || isMemberInfoLoading,
        [isBillingModeLoading, isMemberInfoLoading],
    );

    const menu = useMemo(
        () =>
            getTeamSettingsMenu({
                team,
                billingMode: teamBillingMode,
                ssoEnabled: oidcServiceEnabled,
                orgGitAuthProviders,
            }),
        [oidcServiceEnabled, orgGitAuthProviders, team, teamBillingMode],
    );

    const title = "Organization Settings";
    const subtitle = "Manage your organization's settings.";

    // Render as much of the page as we can in a loading state to avoid content shift
    if (isLoading) {
        return (
            <div className="w-full">
                <Header title={title} subtitle={subtitle} />
                <div className="w-full">
                    <SpinnerLoader />
                </div>
            </div>
        );
    }

    if (!isOwner || !team) {
        return <Redirect to={"/"} />;
    }

    return (
        <PageWithSubMenu subMenu={menu} title={title} subtitle={subtitle}>
            {children}
        </PageWithSubMenu>
    );
}
