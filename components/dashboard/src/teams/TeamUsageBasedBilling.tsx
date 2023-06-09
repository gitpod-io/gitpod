/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { OrgSettingsPage } from "./OrgSettingsPage";
import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";
import { BillingMode } from "@gitpod/gitpod-protocol/lib/billing-mode";
import UsageBasedBillingConfig from "../components/UsageBasedBillingConfig";
import { useOrgBillingMode } from "../data/billing-mode/org-billing-mode-query";
import { useCurrentOrg } from "../data/organizations/orgs-query";

export default function TeamUsageBasedBillingPage() {
    return (
        <OrgSettingsPage>
            <TeamUsageBasedBilling />
        </OrgSettingsPage>
    );
}

function TeamUsageBasedBilling() {
    const org = useCurrentOrg().data;
    const orgBillingMode = useOrgBillingMode();

    if (!BillingMode.showUsageBasedBilling(orgBillingMode.data)) {
        return <></>;
    }

    return (
        <UsageBasedBillingConfig
            hideSubheading
            attributionId={org && AttributionId.render({ kind: "team", teamId: org.id })}
        />
    );
}
