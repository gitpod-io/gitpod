/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Team } from "@gitpod/gitpod-protocol";
import { useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import getSettingsMenu from "./settings-menu";
import { ReactComponent as Spinner } from "../icons/Spinner.svg";
import DropDown from "../components/DropDown";
import { PageWithSubMenu } from "../components/PageWithSubMenu";
import { PaymentContext } from "../payment-context";
import { getGitpodService } from "../service/service";
import { TeamsContext } from "../teams/teams-context";
import { UserContext } from "../user-context";

export default function Billing() {
    const { user } = useContext(UserContext);
    const { showPaymentUI, showUsageBasedUI } = useContext(PaymentContext);
    const { teams } = useContext(TeamsContext);
    const [teamsWithBillingEnabled, setTeamsWithBillingEnabled] = useState<Team[] | undefined>();

    useEffect(() => {
        if (!teams) {
            setTeamsWithBillingEnabled(undefined);
            return;
        }
        const teamsWithBilling: Team[] = [];
        Promise.all(
            teams.map(async (t) => {
                const subscriptionId = await getGitpodService().server.findStripeSubscriptionIdForTeam(t.id);
                if (subscriptionId) {
                    teamsWithBilling.push(t);
                }
            }),
        ).then(() => setTeamsWithBillingEnabled(teamsWithBilling));
    }, [teams]);

    const setUsageAttributionTeam = async (team?: Team) => {
        if (!user) {
            return;
        }
        const additionalData = user.additionalData || {};
        additionalData.usageAttributionId = team ? `team:${team.id}` : `user:${user.id}`;
        await getGitpodService().server.updateLoggedInUser({ additionalData });
    };

    return (
        <PageWithSubMenu
            subMenu={getSettingsMenu({ showPaymentUI, showUsageBasedUI })}
            title="Billing"
            subtitle="Usage-Based Billing."
        >
            <h3>Usage-Based Billing</h3>
            <h2 className="text-gray-500">Manage usage-based billing, spending limit, and payment method.</h2>
            <div className="mt-8">
                <h3>Billing Account</h3>
                {teamsWithBillingEnabled === undefined && <Spinner className="m-2 h-5 w-5 animate-spin" />}
                {teamsWithBillingEnabled && teamsWithBillingEnabled.length === 0 && (
                    <div className="flex space-x-2">
                        <span>
                            <Link className="gp-link" to="/teams/new">
                                Create a team
                            </Link>{" "}
                            to set up usage-based billing.
                        </span>
                    </div>
                )}
                {teamsWithBillingEnabled && teamsWithBillingEnabled.length > 0 && (
                    <div className="flex space-x-2">
                        <span>Bill all my usage to:</span>
                        <DropDown
                            activeEntry={
                                teamsWithBillingEnabled.find(
                                    (t) => `team:${t.id}` === user?.additionalData?.usageAttributionId,
                                )?.name
                            }
                            customClasses="w-32"
                            renderAsLink={true}
                            entries={[
                                {
                                    title: "(myself)",
                                    onClick: () => setUsageAttributionTeam(undefined),
                                },
                            ].concat(
                                teamsWithBillingEnabled.map((t) => ({
                                    title: t.name,
                                    onClick: () => setUsageAttributionTeam(t),
                                })),
                            )}
                        />
                    </div>
                )}
            </div>
        </PageWithSubMenu>
    );
}
