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
import { useOrgWorkspaceClassesQueryInvalidator } from "./org-workspace-classes-query";

type UpdateOrganizationSettingsArgs = Partial<
    Pick<
        OrganizationSettings,
        | "workspaceSharingDisabled"
        | "defaultWorkspaceImage"
        | "allowedWorkspaceClasses"
        | "pinnedEditorVersions"
        | "restrictedEditorNames"
        | "defaultRole"
    >
>;

export const useUpdateOrgSettingsMutation = () => {
    const org = useCurrentOrg().data;
    const invalidateOrgSettings = useOrgSettingsQueryInvalidator();
    const invalidateWorkspaceClasses = useOrgWorkspaceClassesQueryInvalidator();
    const teamId = org?.id || "";

    return useMutation<OrganizationSettings, Error, UpdateOrganizationSettingsArgs>({
        mutationFn: async ({
            workspaceSharingDisabled,
            defaultWorkspaceImage,
            allowedWorkspaceClasses,
            pinnedEditorVersions,
            restrictedEditorNames,
            defaultRole,
        }) => {
            const settings = await organizationClient.updateOrganizationSettings({
                organizationId: teamId,
                workspaceSharingDisabled: workspaceSharingDisabled || false,
                defaultWorkspaceImage,
                allowedWorkspaceClasses,
                updatePinnedEditorVersions: !!pinnedEditorVersions,
                pinnedEditorVersions,
                restrictedEditorNames,
                updateRestrictedEditorNames: !!restrictedEditorNames,
                defaultRole,
            });
            return settings.settings!;
        },
        onSuccess: () => {
            invalidateOrgSettings();
            invalidateWorkspaceClasses();
        },
        onError: (err) => {
            if (!ErrorCode.isUserError((err as any)?.["code"])) {
                console.error(err);
            }
        },
    });
};
