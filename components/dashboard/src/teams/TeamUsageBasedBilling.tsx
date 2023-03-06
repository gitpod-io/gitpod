/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useEffect, useState } from "react";
import { BillingMode } from "@gitpod/gitpod-protocol/lib/billing-mode";
import { useCurrentTeam } from "./teams-context";
import { getGitpodService } from "../service/service";
import UsageBasedBillingConfig from "../components/UsageBasedBillingConfig";
import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";
import { Heading2 } from "../components/typography/headings";

export default function TeamUsageBasedBilling() {
    const team = useCurrentTeam();
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
            <Heading2>Organization Billing</Heading2>
            <UsageBasedBillingConfig attributionId={team && AttributionId.render({ kind: "team", teamId: team.id })} />
        </>
    );
}
