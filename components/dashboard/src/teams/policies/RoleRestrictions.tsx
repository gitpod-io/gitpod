/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { OrganizationSettings } from "@gitpod/public-api/lib/gitpod/v1/organization_pb";
import { useState } from "react";
import { Button } from "@podkit/buttons/Button";
import { ConfigurationSettingsField } from "../../repositories/detail/ConfigurationSettingsField";
import { useMutation } from "@tanstack/react-query";
import type { PlainMessage } from "@bufbuild/protobuf";
import { Link } from "react-router-dom";
import {
    OrganizationRoleRestrictionModal,
    OrganizationRoleRestrictionModalProps,
    OrgMemberPermissionRestrictionsOptions,
} from "../../components/OrgMemberPermissionsOptions";
import { LightbulbIcon } from "lucide-react";
import { Heading3, Subheading } from "@podkit/typography/Headings";

type RolePermissionsRestrictionsProps = {
    settings: OrganizationSettings | undefined;
    isOwner: boolean;
    handleUpdateTeamSettings: (
        newSettings: Partial<PlainMessage<OrganizationSettings>>,
        options?: { throwMutateError?: boolean },
    ) => Promise<void>;
};
export const RolePermissionsRestrictions = ({
    settings,
    isOwner,
    handleUpdateTeamSettings,
}: RolePermissionsRestrictionsProps) => {
    const [showModal, setShowModal] = useState(false);

    const updateMutation: OrganizationRoleRestrictionModalProps["updateMutation"] = useMutation({
        mutationFn: async ({ roleRestrictions }) => {
            await handleUpdateTeamSettings({ roleRestrictions }, { throwMutateError: true });
        },
    });

    return (
        <ConfigurationSettingsField>
            <Heading3>Roles allowed to start workspaces from non-imported repos</Heading3>
            <Subheading className="mb-2">
                Restrict specific roles from initiating workspaces using non-imported repositories. This setting
                requires <span className="font-medium">Owner</span> permissions to modify.
                <br />
                <span className="flex flex-row items-center gap-1 my-2">
                    <LightbulbIcon size={20} />{" "}
                    <span>
                        Tip: Imported repositories are those listed under{" "}
                        <Link to={"/repositories"} className="gp-link">
                            Repository settings
                        </Link>
                        .
                    </span>
                </span>
            </Subheading>

            <OrgMemberPermissionRestrictionsOptions roleRestrictions={settings?.roleRestrictions ?? []} />

            {isOwner && (
                <Button className="mt-6" onClick={() => setShowModal(true)}>
                    Manage Permissions
                </Button>
            )}

            {showModal && (
                <OrganizationRoleRestrictionModal
                    isLoading={false}
                    defaultClass={""}
                    roleRestrictions={settings?.roleRestrictions ?? []}
                    showSetDefaultButton={false}
                    showSwitchTitle={false}
                    allowedClasses={[]}
                    updateMutation={updateMutation}
                    onClose={() => setShowModal(false)}
                />
            )}
        </ConfigurationSettingsField>
    );
};
