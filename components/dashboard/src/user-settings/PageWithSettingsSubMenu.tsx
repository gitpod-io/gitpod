/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { User } from "@gitpod/gitpod-protocol";
import { BillingMode } from "@gitpod/gitpod-protocol/lib/billing-mode";
import { useContext, useMemo } from "react";
import { PageWithSubMenu } from "../components/PageWithSubMenu";
import { FeatureFlagContext } from "../contexts/FeatureFlagContext";
import { useUserBillingMode } from "../data/billing-mode/user-billing-mode-query";
import { useCurrentUser } from "../user-context";
import {
    settingsPathAccount,
    settingsPathBilling,
    settingsPathIntegrations,
    settingsPathMain,
    settingsPathNotifications,
    settingsPathPersonalAccessTokenCreate,
    settingsPathPersonalAccessTokenEdit,
    settingsPathPersonalAccessTokens,
    settingsPathPreferences,
    settingsPathSSHKeys,
    settingsPathVariables,
} from "./settings.routes";

export interface PageWithAdminSubMenuProps {
    children: React.ReactNode;
}

export function PageWithSettingsSubMenu({ children }: PageWithAdminSubMenuProps) {
    const user = useCurrentUser();
    const userBillingMode = useUserBillingMode();
    const { enablePersonalAccessTokens } = useContext(FeatureFlagContext);

    const settingsMenu = useMemo(() => {
        return getSettingsMenu(user, userBillingMode.data, enablePersonalAccessTokens);
    }, [user, userBillingMode, enablePersonalAccessTokens]);

    return (
        <PageWithSubMenu subMenu={settingsMenu} title="User Settings" subtitle="Manage your personal account settings.">
            {children}
        </PageWithSubMenu>
    );
}

function getSettingsMenu(user?: User, userBillingMode?: BillingMode, enablePersonalAccessTokens?: boolean) {
    return [
        {
            title: "Account",
            link: [settingsPathAccount, settingsPathMain],
        },
        {
            title: "Notifications",
            link: [settingsPathNotifications],
        },
        ...renderBillingMenuEntries(user, userBillingMode),
        {
            title: "Variables",
            link: [settingsPathVariables],
        },
        {
            title: "SSH Keys",
            link: [settingsPathSSHKeys],
        },
        {
            title: "Integrations",
            link: [settingsPathIntegrations, "/access-control"],
        },
        ...(enablePersonalAccessTokens
            ? [
                  {
                      title: "Access Tokens",
                      link: [
                          settingsPathPersonalAccessTokens,
                          settingsPathPersonalAccessTokenCreate,
                          settingsPathPersonalAccessTokenEdit,
                      ],
                  },
              ]
            : []),
        {
            title: "Preferences",
            link: [settingsPathPreferences],
        },
    ];
}

function renderBillingMenuEntries(user?: User, billingMode?: BillingMode) {
    if (!billingMode || user?.additionalData?.isMigratedToTeamOnlyAttribution) {
        return [];
    }
    switch (billingMode.mode) {
        case "none":
            return [];
        case "usage-based":
            return [
                {
                    title: "Billing",
                    link: [settingsPathBilling],
                },
                // We need to allow access to "Organization Plans" here, at least for owners.
                ...(BillingMode.showTeamSubscriptionUI(billingMode)
                    ? [
                          {
                              title: "Team Plans (deprecated)",
                              link: ["/old-team-plans"],
                          },
                      ]
                    : []),
            ];
        default:
            return [];
    }
}
