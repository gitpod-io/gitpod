/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";
import { BillingMode } from "@gitpod/gitpod-protocol/lib/billing-mode";
import UsageBasedBillingConfig from "../components/UsageBasedBillingConfig";
import { useCurrentOrg } from "../data/organizations/orgs-query";

export default function TeamUsageBasedBilling() {
    const org = useCurrentOrg().data;

    if (!BillingMode.showUsageBasedBilling(org?.billingMode)) {
        return <></>;
    }

    return (
        <>
            <UsageBasedBillingConfig
                hideSubheading
                attributionId={org && AttributionId.render({ kind: "team", teamId: org.id })}
            />
        </>
    );
}
