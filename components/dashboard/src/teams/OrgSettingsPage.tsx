/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useContext } from "react";
import { PageWithSubMenu } from "../components/PageWithSubMenu";
import { FeatureFlagContext } from "../contexts/FeatureFlagContext";
import { useOrgBillingMode } from "../data/billing-mode/org-billing-mode-query";
import { useCurrentTeam } from "./teams-context";
import { getTeamSettingsMenu } from "./TeamSettings";

export interface OrgSettingsPageProps {
    children: React.ReactNode;
}

export function OrgSettingsPage({ children }: OrgSettingsPageProps) {
    const team = useCurrentTeam();
    const { data: teamBillingMode } = useOrgBillingMode();
    const { oidcServiceEnabled, orgGitAuthProviders } = useContext(FeatureFlagContext);
    const menu = getTeamSettingsMenu({
        team,
        billingMode: teamBillingMode,
        ssoEnabled: oidcServiceEnabled,
        orgGitAuthProviders,
    });

    return (
        <PageWithSubMenu subMenu={menu} title="Organization Settings" subtitle="Manage your organization's settings.">
            {children}
        </PageWithSubMenu>
    );
}
