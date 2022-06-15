/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Team } from "@gitpod/gitpod-protocol";
import { useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DropDown from "../components/DropDown";
import { PageWithSubMenu } from "../components/PageWithSubMenu";
import { PaymentContext } from "../payment-context";
import { getGitpodService } from "../service/service";
import { TeamsContext } from "../teams/teams-context";
import { UserContext } from "../user-context";
import getSettingsMenu from "./settings-menu";

export default function Billing() {
    const { user } = useContext(UserContext);
    const { showPaymentUI, showUsageBasedUI } = useContext(PaymentContext);
    const { teams } = useContext(TeamsContext);
    const [teamsWithBillingEnabled, setTeamsWithBillingEnabled] = useState<Team[]>([]);

    const userFullName = user?.fullName || user?.name || "...";

    useEffect(() => {
        if (!teams) {
            setTeamsWithBillingEnabled([]);
            return;
        }
        const teamsWithBilling: Team[] = [];
        Promise.all(
            teams.map(async (t) => {
                const customerId = await getGitpodService().server.findStripeCustomerIdForTeam(t.id);
                if (customerId) {
                    teamsWithBilling.push(t);
                }
            }),
        ).then(() => setTeamsWithBillingEnabled(teamsWithBilling));
    }, [teams]);

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
            <div className="flex space-x-4">
                Bill all usage to:
                <DropDown
                    customClasses="w-32"
                    activeEntry={userFullName}
                    entries={[
                        {
                            title: userFullName,
                            onClick: () => {},
                        },
                    ].concat(
                        teamsWithBillingEnabled.map((t) => ({
                            title: t.name,
                            onClick: () => {},
                        })),
                    )}
                />
            </div>
        </PageWithSubMenu>
    );
}
