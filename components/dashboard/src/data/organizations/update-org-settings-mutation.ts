/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useMutation } from "@tanstack/react-query";
import { useOrgSettingsQueryInvalidator } from "./org-settings-query";
import { useCurrentOrg } from "./orgs-query";
import { organizationClient } from "../../service/public-api";
import {
    OrganizationSettings,
    UpdateOrganizationSettingsRequest,
} from "@gitpod/public-api/lib/gitpod/v1/organization_pb";
import { FieldMask } from "@bufbuild/protobuf";

type UpdateOrganizationSettingsArgs = Partial<
    Pick<OrganizationSettings, "workspaceSharingDisabled" | "defaultWorkspaceImage">
>;

export const useUpdateOrgSettingsMutation = () => {
    const org = useCurrentOrg().data;
    const invalidator = useOrgSettingsQueryInvalidator();
    const organizationId = org?.id || "";

    return useMutation<OrganizationSettings, Error, UpdateOrganizationSettingsArgs>({
        mutationFn: async ({ workspaceSharingDisabled, defaultWorkspaceImage }) => {
            const request = new UpdateOrganizationSettingsRequest({
                organizationId,
                workspaceSharingDisabled,
            });
            defaultWorkspaceImage = defaultWorkspaceImage?.trim();
            if (defaultWorkspaceImage) {
                request.defaultWorkspaceImage = defaultWorkspaceImage;
            } else if (defaultWorkspaceImage === "") {
                request.resetMask = new FieldMask({
                    paths: ["default_workspace_image"],
                });
            }
            const settings = await organizationClient.updateOrganizationSettings(request);
            return settings.settings!;
        },
        onSuccess: invalidator,
    });
};
