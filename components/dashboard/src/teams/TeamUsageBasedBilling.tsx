/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { OrgSettingsPage } from "./OrgSettingsPage";
import { BillingMode } from "@gitpod/gitpod-protocol/lib/billing-mode";
import UsageBasedBillingConfig from "../components/UsageBasedBillingConfig";
import { useOrgBillingMode } from "../data/billing-mode/org-billing-mode-query";
import { useIsOwner } from "../data/organizations/members-query";
import { Redirect } from "react-router";

export default function TeamUsageBasedBillingPage() {
    return (
        <OrgSettingsPage>
            <TeamUsageBasedBilling />
        </OrgSettingsPage>
    );
}

function TeamUsageBasedBilling() {
    const orgBillingMode = useOrgBillingMode();
    const isOwner = useIsOwner();

    if (!isOwner) {
        return <Redirect to="/settings" />;
    }

    if (!BillingMode.showUsageBasedBilling(orgBillingMode.data)) {
        return <></>;
    }

    return <UsageBasedBillingConfig hideSubheading />;
}
