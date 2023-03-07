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
import { useCurrentOrg } from "../data/organizations/orgs-query";
import { getTeamSettingsMenu } from "./TeamSettings";

export interface OrgSettingsPageProps {
    children: React.ReactNode;
}

export function OrgSettingsPage({ children }: OrgSettingsPageProps) {
    const org = useCurrentOrg();
    const { oidcServiceEnabled, orgGitAuthProviders } = useFeatureFlags();

    const menu = useMemo(
        () =>
            getTeamSettingsMenu({
                team: org.data,
                billingMode: org.data?.billingMode,
                ssoEnabled: oidcServiceEnabled,
                orgGitAuthProviders,
            }),
        [oidcServiceEnabled, orgGitAuthProviders, org.data],
    );

    const title = "Organization Settings";
    const subtitle = "Manage your organization's settings.";

    // Render as much of the page as we can in a loading state to avoid content shift
    if (org.isLoading) {
        return (
            <div className="w-full">
                <Header title={title} subtitle={subtitle} />
                <div className="w-full">
                    <SpinnerLoader />
                </div>
            </div>
        );
    }

    // After we've loaded, ensure user is an owner, if not, redirect
    if (!org.data?.isOwner) {
        return <Redirect to={"/"} />;
    }

    return (
        <PageWithSubMenu subMenu={menu} title={title} subtitle={subtitle}>
            {children}
        </PageWithSubMenu>
    );
}
