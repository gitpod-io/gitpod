/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";
import { Redirect } from "react-router";
import { BillingAccountSelector } from "../components/BillingAccountSelector";
import UsageBasedBillingConfig from "../components/UsageBasedBillingConfig";
import { useCurrentUser } from "../user-context";
import { PageWithSettingsSubMenu } from "./PageWithSettingsSubMenu";

export default function Billing() {
    const user = useCurrentUser();
    if (user?.additionalData?.isMigratedToTeamOnlyAttribution) {
        return <Redirect to="/user/account" />;
    }

    return (
        <PageWithSettingsSubMenu>
            <div>
                <h3>Default Billing Account</h3>
                <BillingAccountSelector />
                {!user?.additionalData?.isMigratedToTeamOnlyAttribution && (
                    <>
                        <h3 className="mt-12">Personal Billing</h3>
                        <UsageBasedBillingConfig
                            attributionId={user && AttributionId.render({ kind: "user", userId: user.id })}
                        />
                    </>
                )}
            </div>
        </PageWithSettingsSubMenu>
    );
}
