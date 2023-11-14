/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useMutation } from "@tanstack/react-query";
import { useCurrentOrg, useOrganizationsInvalidator } from "./orgs-query";
import { organizationClient } from "../../service/public-api";
import { Organization } from "@gitpod/public-api/lib/gitpod/v1/organization_pb";

type UpdateOrgArgs = Pick<Organization, "name">;

export const useUpdateOrgMutation = () => {
    const org = useCurrentOrg().data;
    const invalidateOrgs = useOrganizationsInvalidator();

    return useMutation<Organization, Error, UpdateOrgArgs>({
        mutationFn: async ({ name }) => {
            if (!org) {
                throw new Error("No current organization selected");
            }

            const response = await organizationClient.updateOrganization({
                organizationId: org.id,
                name,
            });
            return response.organization!;
        },
        onSuccess(updatedOrg) {
            // TODO: Update query cache with new org prior to invalidation so it's reflected immediately
            invalidateOrgs();
        },
    });
};
