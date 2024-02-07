/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useMemo } from "react";
import { PageWithSubMenu } from "../components/PageWithSubMenu";
import { useFeatureFlag } from "../data/featureflag-query";
import {
    settingsPathAccount,
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
    const enablePersonalAccessTokens = useFeatureFlag("personalAccessTokensEnabled");

    const settingsMenu = useMemo(() => {
        return getSettingsMenu(enablePersonalAccessTokens);
    }, [enablePersonalAccessTokens]);

    return (
        <PageWithSubMenu subMenu={settingsMenu} title="User settings" subtitle="Manage your personal account settings.">
            {children}
        </PageWithSubMenu>
    );
}

function getSettingsMenu(enablePersonalAccessTokens?: boolean) {
    return [
        {
            title: "Account",
            link: [settingsPathAccount, settingsPathMain],
        },
        {
            title: "Notifications",
            link: [settingsPathNotifications],
        },
        {
            title: "Variables",
            link: [settingsPathVariables],
        },
        {
            title: "SSH keys",
            link: [settingsPathSSHKeys],
        },
        {
            title: "Git providers",
            link: [settingsPathIntegrations, "/access-control"],
        },
        ...(enablePersonalAccessTokens
            ? [
                  {
                      title: "Access tokens",
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
