/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

export default function getSettingsMenu(params: { showPaymentUI?: boolean }) {
    return [
        {
            title: "Account",
            link: ["/account", "/settings"],
        },
        {
            title: "Notifications",
            link: ["/notifications"],
        },
        ...(params.showPaymentUI
            ? [
                  {
                      title: "Plans",
                      link: ["/plans"],
                  },
                  {
                      title: "Team Plans",
                      link: ["/teams"],
                  },
              ]
            : []),
        {
            title: "Variables",
            link: ["/variables"],
        },
        {
            title: "Integrations",
            link: ["/integrations", "/access-control"],
        },
        {
            title: "Preferences",
            link: ["/preferences"],
        },
    ];
}
