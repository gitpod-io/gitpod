/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useQuery } from "@tanstack/react-query";
import { getGitpodService } from "../../service/service";
import { useCurrentOrg } from "../organizations/orgs-query";
import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";

export const useIsOrgOnPaidPlan = () => {
    const organization = useCurrentOrg().data;

    return useQuery<boolean>({
        queryKey: getOrgBillingModeQueryKey(organization?.id ?? ""),
        queryFn: async () => {
            if (!organization) {
                return false;
            }

            const attributionId = AttributionId.render(AttributionId.createFromOrganizationId(organization.id));
            const subscriptionId = await getGitpodService().server.findStripeSubscriptionId(attributionId);

            return !!subscriptionId;
        },
        enabled: !!organization,
    });
};

export const getOrgBillingModeQueryKey = (organizationId: string) => ["has-paid-plan", { organizationId }];
