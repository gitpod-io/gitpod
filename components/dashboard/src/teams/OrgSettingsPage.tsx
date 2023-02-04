/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useContext } from "react";
import { PageWithSubMenu } from "../components/PageWithSubMenu";
import { FeatureFlagContext } from "../contexts/FeatureFlagContext";
import { useCurrentTeam, useBillingModeForCurrentTeam } from "./teams-context";
import { getTeamSettingsMenu } from "./TeamSettings";

export interface OrgSettingsPageProps {
    children: React.ReactNode;
}

export function OrgSettingsPage({ children }: OrgSettingsPageProps) {
    const team = useCurrentTeam();
    const teamBillingMode = useBillingModeForCurrentTeam();
    const { oidcServiceEnabled } = useContext(FeatureFlagContext);
    const menu = getTeamSettingsMenu({ team, billingMode: teamBillingMode, ssoEnabled: oidcServiceEnabled });

    return (
        <PageWithSubMenu subMenu={menu} title="Organization Settings" subtitle="Manage your organization's settings.">
            {children}
        </PageWithSubMenu>
    );
}
