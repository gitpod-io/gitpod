/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { useContext } from "react";
import { PageWithSubMenu } from "../components/PageWithSubMenu";
import { PaymentContext } from "../payment-context";
import getSettingsMenu from "./settings-menu";

export default function Billing() {
    const { showPaymentUI, showUsageBasedUI } = useContext(PaymentContext);

    return (
        <PageWithSubMenu
            subMenu={getSettingsMenu({ showPaymentUI, showUsageBasedUI })}
            title="Billing"
            subtitle="Usage-Based Billing."
        >
            <h3>Billing</h3>
        </PageWithSubMenu>
    );
}
