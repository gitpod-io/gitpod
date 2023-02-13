/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { User } from "@gitpod/gitpod-protocol";
import { BillingMode } from "@gitpod/gitpod-protocol/lib/billing-mode";
import { useContext } from "react";
import { PageWithSubMenu } from "../components/PageWithSubMenu";
import { FeatureFlagContext } from "../contexts/FeatureFlagContext";
import { UserContext } from "../user-context";
import {
    settingsPathAccount,
    settingsPathBilling,
    settingsPathIntegrations,
    settingsPathMain,
    settingsPathNotifications,
    settingsPathPersonalAccessTokenCreate,
    settingsPathPersonalAccessTokenEdit,
    settingsPathPersonalAccessTokens,
    settingsPathPlans,
    settingsPathPreferences,
    settingsPathSSHKeys,
    settingsPathVariables,
} from "./settings.routes";

export interface PageWithAdminSubMenuProps {
    children: React.ReactNode;
}

export function PageWithSettingsSubMenu({ children }: PageWithAdminSubMenuProps) {
    const { userBillingMode, user } = useContext(UserContext);
    const { enablePersonalAccessTokens } = useContext(FeatureFlagContext);

    return (
        <PageWithSubMenu
            subMenu={getSettingsMenu(user, userBillingMode, enablePersonalAccessTokens)}
            title="User Settings"
            subtitle="Manage your personal account settings."
        >
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
        case "chargebee":
            return [
                {
                    title: "Plans",
                    link: [settingsPathPlans],
                },
                {
                    title: "Team Plans (deprecated)",
                    link: ["/old-team-plans"],
                },
                ...(BillingMode.showUsageBasedBilling(billingMode)
                    ? [
                          {
                              title: "Billing",
                              link: [settingsPathBilling],
                          },
                      ]
                    : []),
            ];
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
    }
}
