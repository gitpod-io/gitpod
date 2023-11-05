/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { toPlainMessage, PlainMessage } from "@bufbuild/protobuf";
import { useMutation } from "@tanstack/react-query";
import { useOrganizationsInvalidator } from "./orgs-query";
import { organizationClient } from "../../service/public-api";
import { Organization } from "@gitpod/public-api/lib/gitpod/v1/organization_pb";

type CreateOrgArgs = Pick<Organization, "name">;

export const useCreateOrgMutation = () => {
    const invalidateOrgs = useOrganizationsInvalidator();

    return useMutation<PlainMessage<Organization>, Error, CreateOrgArgs>({
        mutationFn: async ({ name }) => {
            const { organization } = await organizationClient.createOrganization({ name });
            if (!organization) {
                throw new Error("Error creating organization");
            }

            return toPlainMessage(organization);
        },
        onSuccess(newOrg) {
            invalidateOrgs();
        },
    });
};
