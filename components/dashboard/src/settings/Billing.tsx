/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { PageWithSettingsSubMenu } from "./PageWithSettingsSubMenu";
import { BillingAccountSelector } from "../components/BillingAccountSelector";
import UsageBasedBillingConfig from "../components/UsageBasedBillingConfig";

export default function Billing() {
    return (
        <PageWithSettingsSubMenu title="Billing" subtitle="Usage-Based Billing.">
            <div>
                <h3>Billing Account</h3>
                <BillingAccountSelector />
                <h3 className="mt-12">Usage-Based Billing</h3>
                <UsageBasedBillingConfig
                    userOrTeamId={""}
                    showSpinner={false}
                    showUpgradeBilling={true}
                    showManageBilling={false}
                    doUpdateLimit={function (_: number): Promise<void> {
                        throw new Error("Function not implemented.");
                    }}
                />
            </div>
        </PageWithSettingsSubMenu>
    );
}
