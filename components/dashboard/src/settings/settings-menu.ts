/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { BillingMode } from "@gitpod/gitpod-protocol/lib/billing-mode";
import {
    settingsPathAccount,
    settingsPathBilling,
    settingsPathIntegrations,
    settingsPathMain,
    settingsPathNotifications,
    settingsPathPlans,
    settingsPathPreferences,
    settingsPathVariables,
    settingsPathSSHKeys,
    settingsPathPersonalAccessTokens,
    settingsPathPersonalAccessTokenCreate,
    settingsPathPersonalAccessTokenEdit,
} from "./settings.routes";

export default function getSettingsMenu(params: {
    userBillingMode?: BillingMode;
    enablePersonalAccessTokens?: boolean;
}) {
    return [
        {
            title: "Account",
            link: [settingsPathAccount, settingsPathMain],
        },
        {
            title: "Notifications",
            link: [settingsPathNotifications],
        },
        ...renderBillingMenuEntries(params.userBillingMode),
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
        ...(params.enablePersonalAccessTokens
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

function renderBillingMenuEntries(billingMode?: BillingMode) {
    if (!billingMode) {
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
