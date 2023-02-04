/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useContext } from "react";
import { PageWithSubMenu } from "../components/PageWithSubMenu";
import { FeatureFlagContext } from "../contexts/FeatureFlagContext";
import { UserContext } from "../user-context";
import getSettingsMenu from "./settings-menu";

export interface PageWithAdminSubMenuProps {
    children: React.ReactNode;
}

export function PageWithSettingsSubMenu({ children }: PageWithAdminSubMenuProps) {
    const { userBillingMode } = useContext(UserContext);
    const { enablePersonalAccessTokens } = useContext(FeatureFlagContext);

    return (
        <PageWithSubMenu
            subMenu={getSettingsMenu({ userBillingMode, enablePersonalAccessTokens })}
            title="User Settings"
            subtitle="Manage your personal account settings."
        >
            {children}
        </PageWithSubMenu>
    );
}
