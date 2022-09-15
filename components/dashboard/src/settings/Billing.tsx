/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { useContext } from "react";
import { PageWithSettingsSubMenu } from "./PageWithSettingsSubMenu";
import { BillingAccountSelector } from "../components/BillingAccountSelector";
import { UserContext } from "../user-context";
import UsageBasedBillingConfig from "../components/UsageBasedBillingConfig";
import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";

export default function Billing() {
    const { user } = useContext(UserContext);
    const attributionId: AttributionId = { kind: "user", userId: user?.id || "" };

    return (
        <PageWithSettingsSubMenu title="Billing" subtitle="Usage-Based Billing.">
            <div>
                <h3>Billing Account</h3>
                <BillingAccountSelector />
                <h3 className="mt-12">Usage-Based Billing</h3>
                <UsageBasedBillingConfig subject={user} attributionId={AttributionId.render(attributionId)} />
            </div>
        </PageWithSettingsSubMenu>
    );
}
