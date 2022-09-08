/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { useContext, useEffect, useState } from "react";

import { getGitpodService, gitpodHostUrl } from "./service/service";
import { BillingMode } from "@gitpod/gitpod-protocol/lib/billing-mode";
import UsageView from "./components/UsageView";
import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";
import { UserContext } from "./user-context";

function TeamUsage() {
    const { user } = useContext(UserContext);
    const [billingMode, setBillingMode] = useState<BillingMode | undefined>(undefined);
    const [attributionId, setAttributionId] = useState<AttributionId | undefined>();

    useEffect(() => {
        if (!user) {
            return;
        }
        setAttributionId({ kind: "user", userId: user.id });
        (async () => {
            const billingMode = await getGitpodService().server.getBillingModeForUser();
            setBillingMode(billingMode);
        })();
    }, [user]);

    useEffect(() => {
        if (!billingMode) {
            return;
        }
        if (!BillingMode.showUsageBasedBilling(billingMode)) {
            window.location.href = gitpodHostUrl.asDashboard().toString();
        }
    }, [billingMode]);

    if (!billingMode || !attributionId) {
        return <></>;
    }

    return <UsageView billingMode={billingMode} attributionId={attributionId} />;
}

export default TeamUsage;
