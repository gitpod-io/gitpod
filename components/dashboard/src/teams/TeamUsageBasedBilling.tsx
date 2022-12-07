/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useContext, useEffect, useState } from "react";
import { useLocation } from "react-router";
import { BillingMode } from "@gitpod/gitpod-protocol/lib/billing-mode";
import { getCurrentTeam, TeamsContext } from "./teams-context";
import { getGitpodService } from "../service/service";
import UsageBasedBillingConfig from "../components/UsageBasedBillingConfig";
import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";

export default function TeamUsageBasedBilling() {
    const { teams } = useContext(TeamsContext);
    const location = useLocation();
    const team = getCurrentTeam(location, teams);
    const [teamBillingMode, setTeamBillingMode] = useState<BillingMode | undefined>(undefined);

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
            <h3>Team Billing</h3>
            <UsageBasedBillingConfig attributionId={team && AttributionId.render({ kind: "team", teamId: team.id })} />
        </>
    );
}
