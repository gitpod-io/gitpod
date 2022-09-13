/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { useContext, useEffect, useState } from "react";
import { useLocation } from "react-router";
import { BillingMode } from "@gitpod/gitpod-protocol/lib/billing-mode";
import { getCurrentTeam, TeamsContext } from "./teams-context";
import { getGitpodService } from "../service/service";
import UsageBasedBillingConfig from "../components/UsageBasedBillingConfig";
import Alert from "../components/Alert";
import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";
import useStripe from "../hooks/useStripe";

export default function TeamUsageBasedBilling() {
    const { teams } = useContext(TeamsContext);
    const location = useLocation();
    const team = getCurrentTeam(location, teams);
    const [teamBillingMode, setTeamBillingMode] = useState<BillingMode | undefined>(undefined);
    const attributionId: AttributionId = { kind: "team", teamId: team?.id || "" };
    const [
        showSpinner,
        billingError,
        showUpgradeBilling,
        showManageBilling,
        stripePortalUrl,
        usageLimit,
        doUpdateLimit,
    ] = useStripe(team, attributionId, `pendingStripeSubscriptionForTeam${team?.id || ""}`);

    useEffect(() => {
        if (!team) return;

        (async () => {
            const teamBillingMode = await getGitpodService().server.getBillingModeForTeam(team.id);
            setTeamBillingMode(teamBillingMode);
        })();
    }, [team]);

    if (!BillingMode.showUsageBasedBilling(teamBillingMode)) {
        return <></>;
    }

    return (
        <>
            {billingError && (
                <Alert className="max-w-xl mb-4" closable={false} showIcon={true} type="error">
                    {billingError}
                </Alert>
            )}
            <h3>Usage-Based Billing</h3>
            <UsageBasedBillingConfig
                attributionId={attributionId}
                showSpinner={showSpinner}
                showUpgradeBilling={showUpgradeBilling}
                showManageBilling={showManageBilling}
                stripePortalUrl={stripePortalUrl}
                usageLimit={usageLimit}
                doUpdateLimit={doUpdateLimit}
            />
        </>
    );
}
