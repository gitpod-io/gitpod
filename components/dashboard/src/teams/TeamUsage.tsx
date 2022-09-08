/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { useContext, useEffect, useState } from "react";
import { useLocation } from "react-router";
import { getCurrentTeam, TeamsContext } from "./teams-context";
import { getGitpodService, gitpodHostUrl } from "../service/service";
import { BillingMode } from "@gitpod/gitpod-protocol/lib/billing-mode";
import UsageView from "../components/UsageView";
import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";

function TeamUsage() {
    const { teams } = useContext(TeamsContext);
    const location = useLocation();
    const team = getCurrentTeam(location, teams);
    const [billingMode, setBillingMode] = useState<BillingMode | undefined>(undefined);
    const [attributionId, setAttributionId] = useState<AttributionId | undefined>();

    useEffect(() => {
        if (!team) {
            return;
        }
        setAttributionId({ kind: "team", teamId: team.id });
        (async () => {
            const billingMode = await getGitpodService().server.getBillingModeForTeam(team.id);
            setBillingMode(billingMode);
        })();
    }, [team]);

    useEffect(() => {
        if (!billingMode) {
            return;
        }
        if (!BillingMode.showUsageBasedBilling(billingMode)) {
            window.location.href = gitpodHostUrl.asDashboard().toString();
        }
    }, [billingMode]);

    if (!billingMode || !attributionId) {
        return <></>;
    }

    return <UsageView billingMode={billingMode} attributionId={attributionId} />;
}

export default TeamUsage;
