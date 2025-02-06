/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { PageWithSubMenu } from "../components/PageWithSubMenu";
import { useInstallationConfiguration } from "../data/installation/installation-config-query";
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
    const settingsMenu = useUserSettingsMenu();
    return (
        <PageWithSubMenu subMenu={settingsMenu} title="User Settings" subtitle="Manage your personal account settings.">
            {children}
        </PageWithSubMenu>
    );
}

function useUserSettingsMenu() {
    const { data: installationConfig } = useInstallationConfiguration();
    const isGitpodIo = installationConfig?.isDedicatedInstallation === false;

    return [
        {
            title: "Account",
            link: [settingsPathAccount, settingsPathMain],
        },
        ...(isGitpodIo
            ? [
                  {
                      title: "Notifications",
                      link: [settingsPathNotifications],
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
            title: "Git Providers",
            link: [settingsPathIntegrations, "/access-control"],
        },
        {
            title: "Access Tokens",
            link: [
                settingsPathPersonalAccessTokens,
                settingsPathPersonalAccessTokenCreate,
                settingsPathPersonalAccessTokenEdit,
            ],
        },
        {
            title: "Preferences",
            link: [settingsPathPreferences],
        },
    ];
}
