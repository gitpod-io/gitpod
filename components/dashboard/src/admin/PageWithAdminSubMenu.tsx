/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { useContext } from "react";
import { PageWithSubMenu } from "../components/PageWithSubMenu";
import { getAdminMenu } from "./admin-menu";
import { FeatureFlagContext } from "../contexts/FeatureFlagContext";

export interface PageWithAdminSubMenuProps {
    title: string;
    subtitle: string;
    children: React.ReactNode;
}

export function PageWithAdminSubMenu({ title, subtitle, children }: PageWithAdminSubMenuProps) {
    const { isBlockedRepositoriesUIEnabled } = useContext(FeatureFlagContext);

    return (
        <PageWithSubMenu subMenu={getAdminMenu(isBlockedRepositoriesUIEnabled)} title={title} subtitle={subtitle}>
            {children}
        </PageWithSubMenu>
    );
}
