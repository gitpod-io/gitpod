/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { useContext } from "react";
import { PageWithSubMenu } from "../components/PageWithSubMenu";
import { PaymentContext } from "../payment-context";
import getSettingsMenu from "./settings-menu";

export interface PageWithAdminSubMenuProps {
    title: string;
    subtitle: string;
    children: React.ReactNode;
}

export function PageWithSettingsSubMenu({ title, subtitle, children }: PageWithAdminSubMenuProps) {
    const { showPaymentUI, showUsageBasedUI } = useContext(PaymentContext);

    return (
        <PageWithSubMenu
            subMenu={getSettingsMenu({ showPaymentUI, showUsageBasedUI })}
            title={title}
            subtitle={subtitle}
        >
            {children}
        </PageWithSubMenu>
    );
}
