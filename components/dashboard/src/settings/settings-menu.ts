/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import {
    settingsPathAccount,
    settingsPathBilling,
    settingsPathIntegrations,
    settingsPathMain,
    settingsPathNotifications,
    settingsPathPlans,
    settingsPathPreferences,
    settingsPathTeams,
    settingsPathVariables,
    settingsPathSSHKeys,
} from "./settings.routes";

export default function getSettingsMenu(params: { showPaymentUI?: boolean; showUsageBasedUI?: boolean }) {
    return [
        {
            title: "Account",
            link: [settingsPathAccount, settingsPathMain],
        },
        {
            title: "Notifications",
            link: [settingsPathNotifications],
        },
        ...(params.showPaymentUI
            ? [
                  ...(params.showUsageBasedUI
                      ? [
                            {
                                title: "Billing",
                                link: [settingsPathBilling],
                            },
                        ]
                      : []),
                  {
                      title: "Plans",
                      link: [settingsPathPlans],
                  },
                  {
                      title: "Team Plans",
                      link: [settingsPathTeams],
                  },
              ]
            : []),
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
        {
            title: "Preferences",
            link: [settingsPathPreferences],
        },
    ];
}
