/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { PageWithSubMenu } from "../components/PageWithSubMenu";
import { getAdminMenu } from "./admin-menu";

export interface PageWithAdminSubMenuProps {
    title: string;
    subtitle: string;
    children: React.ReactNode;
}

export function PageWithAdminSubMenu({ title, subtitle, children }: PageWithAdminSubMenuProps) {
    return (
        <PageWithSubMenu subMenu={getAdminMenu()} title={title} subtitle={subtitle}>
            {children}
        </PageWithSubMenu>
    );
}
