/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";
import { Redirect } from "react-router";
import { BillingAccountSelector } from "../components/BillingAccountSelector";
import { Heading2 } from "../components/typography/headings";
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
                <Heading2>Default Billing Account</Heading2>
                <BillingAccountSelector />
                {!user?.additionalData?.isMigratedToTeamOnlyAttribution && (
                    <>
                        <Heading2 className="mt-12">Personal Billing</Heading2>
                        <UsageBasedBillingConfig
                            attributionId={user && AttributionId.render({ kind: "user", userId: user.id })}
                        />
                    </>
                )}
            </div>
        </PageWithSettingsSubMenu>
    );
}
