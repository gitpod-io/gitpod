/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { useContext } from "react";
import { Link } from "react-router-dom";
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
            <h3>Usage-Based Billing</h3>
            <h2 className="text-gray-500">Manage usage-based billing, spending limit, and payment method.</h2>
            <p className="mt-8">
                Hint:{" "}
                <Link className="gp-link" to="/teams/new">
                    Create a team
                </Link>{" "}
                to set up usage-based billing.
            </p>
        </PageWithSubMenu>
    );
}
