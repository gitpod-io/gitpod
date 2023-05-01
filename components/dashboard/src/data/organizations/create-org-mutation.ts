/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Organization } from "@gitpod/gitpod-protocol";
import { useMutation } from "@tanstack/react-query";
import { useOrganizationsInvalidator } from "./orgs-query";
import { publicApiTeamToProtocol, teamsService } from "../../service/public-api";

type CreateOrgArgs = Pick<Organization, "name">;

export const useCreateOrgMutation = () => {
    const invalidateOrgs = useOrganizationsInvalidator();

    return useMutation<Organization, Error, CreateOrgArgs>({
        mutationFn: async ({ name }) => {
            const { team } = await teamsService.createTeam({ name });
            if (!team) {
                throw new Error("Error creating team");
            }

            const org = publicApiTeamToProtocol(team);
            return org;
        },
        onSuccess(newOrg) {
            invalidateOrgs();
        },
    });
};
