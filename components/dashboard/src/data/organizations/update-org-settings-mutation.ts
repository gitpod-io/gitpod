/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useMutation } from "@tanstack/react-query";
import { useOrgSettingsQueryInvalidator } from "./org-settings-query";
import { useCurrentOrg } from "./orgs-query";
import { organizationClient } from "../../service/public-api";
import { OrganizationSettings } from "@gitpod/public-api/lib/gitpod/v1/organization_pb";
import { ErrorCode } from "@gitpod/gitpod-protocol/lib/messaging/error";

type UpdateOrganizationSettingsArgs = Partial<
    Pick<OrganizationSettings, "workspaceSharingDisabled" | "defaultWorkspaceImage" | "allowedWorkspaceClasses">
>;

export const useUpdateOrgSettingsMutation = () => {
    const org = useCurrentOrg().data;
    const invalidator = useOrgSettingsQueryInvalidator();
    const teamId = org?.id || "";

    return useMutation<OrganizationSettings, Error, UpdateOrganizationSettingsArgs>({
        mutationFn: async ({ workspaceSharingDisabled, defaultWorkspaceImage, allowedWorkspaceClasses }) => {
            const settings = await organizationClient.updateOrganizationSettings({
                organizationId: teamId,
                workspaceSharingDisabled: workspaceSharingDisabled || false,
                defaultWorkspaceImage,
                allowedWorkspaceClasses,
            });
            return settings.settings!;
        },
        onSuccess: invalidator,
        onError: (err) => {
            if (!ErrorCode.isUserError((err as any)?.["code"])) {
                console.error(err);
            }
        },
    });
};
