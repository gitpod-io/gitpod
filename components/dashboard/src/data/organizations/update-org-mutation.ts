/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Organization } from "@gitpod/gitpod-protocol";
import { useMutation } from "@tanstack/react-query";
import { getGitpodService } from "../../service/service";
import { useCurrentOrg, useOrganizationsInvalidator } from "./orgs-query";

type UpdateOrgArgs = Pick<Organization, "name">;

export const useUpdateOrgMutation = () => {
    const org = useCurrentOrg().data;
    const invalidateOrgs = useOrganizationsInvalidator();

    return useMutation<Organization, Error, UpdateOrgArgs>({
        mutationFn: async ({ name }) => {
            if (!org) {
                throw new Error("No current organization selected");
            }

            return await getGitpodService().server.updateTeam(org.id, { name });
        },
        onSuccess(updatedOrg) {
            // TODO: Update query cache with new org prior to invalidation so it's reflected immediately
            invalidateOrgs();
        },
    });
};
