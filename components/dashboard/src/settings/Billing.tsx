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

    return (
        <PageWithSettingsSubMenu title="Billing" subtitle="Configure and manage billing for your personal account.">
            <div>
                <h3>Default Billing Account</h3>
                <BillingAccountSelector />
                <h3 className="mt-12">Personal Billing</h3>
                <UsageBasedBillingConfig
                    attributionId={user && AttributionId.render({ kind: "user", userId: user.id })}
                />
            </div>
        </PageWithSettingsSubMenu>
    );
}
