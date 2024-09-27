/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useState } from "react";
import { LoadingButton } from "@podkit/buttons/LoadingButton";
import { Button } from "@podkit/buttons/Button";
import { SwitchInputField } from "@podkit/switch/Switch";
import { cn } from "@podkit/lib/cn";
import { UserIcon } from "lucide-react";
import { UseMutationResult } from "@tanstack/react-query";
import { AllowedWorkspaceClass } from "../data/workspaces/workspace-classes-query";
import { useToast } from "./toasts/Toasts";
import Modal, { ModalBaseFooter, ModalBody, ModalHeader } from "./Modal";
import { LoadingState } from "@podkit/loading/LoadingState";
import { VALID_ORG_MEMBER_ROLES } from "@gitpod/gitpod-protocol";
import { OrganizationPermission, RoleRestrictionEntry } from "@gitpod/public-api/lib/gitpod/v1/organization_pb";
import { PlainMessage } from "@bufbuild/protobuf";
import { PublicAPIConverter } from "@gitpod/public-api-common/lib/public-api-converter";

const converter = new PublicAPIConverter();

interface WorkspaceClassesOptionsProps {
    roleRestrictions: RoleRestrictionEntry[];
    defaultClass?: string;
    className?: string;
}

export const OrgMemberPermissionRestrictionsOptions = ({
    roleRestrictions,
    className,
}: WorkspaceClassesOptionsProps) => {
    const rolesRestrictingArbitraryRepositories = roleRestrictions.filter((entry) =>
        entry.permissions.includes(OrganizationPermission.START_ARBITRARY_REPOS),
    );
    const rolesAllowedToOpenArbitraryRepositories = VALID_ORG_MEMBER_ROLES.filter(
        (role) =>
            !rolesRestrictingArbitraryRepositories.some((entry) => entry.role === converter.toOrgMemberRole(role)),
    );

    if (rolesAllowedToOpenArbitraryRepositories.length === 0) {
        return <div>Nobody in the organization can open repositories that are not imported</div>;
    }

    return (
        <div className={cn("space-y-2", className)}>
            {rolesAllowedToOpenArbitraryRepositories.map((entry) => (
                <div className="flex gap-2 items-center">
                    <UserIcon size={20} />
                    <div>
                        <span className="font-medium text-pk-content-primary capitalize">{entry}</span>
                    </div>
                </div>
            ))}
        </div>
    );
};

export type OrganizationRoleRestrictionModalProps = {
    isLoading: boolean;
    defaultClass?: string;
    roleRestrictions: RoleRestrictionEntry[];
    showSetDefaultButton: boolean;
    showSwitchTitle: boolean;

    allowedClasses: AllowedWorkspaceClass[];
    updateMutation: UseMutationResult<void, Error, { roleRestrictions: PlainMessage<RoleRestrictionEntry>[] }>;

    onClose: () => void;
};

export const OrganizationRoleRestrictionModal = ({
    onClose,
    updateMutation,
    showSetDefaultButton,
    showSwitchTitle,
    ...props
}: OrganizationRoleRestrictionModalProps) => {
    const [restrictedRoles, setRestrictedClasses] = useState(
        props.roleRestrictions
            .filter((entry) => entry.permissions.includes(OrganizationPermission.START_ARBITRARY_REPOS))
            .map((entry) => converter.fromOrgMemberRole(entry.role)),
    );

    const { toast } = useToast();

    const handleUpdate = async () => {
        updateMutation.mutate(
            {
                roleRestrictions: restrictedRoles.map((role) => {
                    return {
                        role: converter.toOrgMemberRole(role),
                        permissions: [OrganizationPermission.START_ARBITRARY_REPOS],
                    };
                }),
            },
            {
                onSuccess: () => {
                    toast({ message: "Role restrictions updated" });
                    onClose();
                },
            },
        );
    };

    return (
        <Modal visible onClose={onClose} onSubmit={handleUpdate}>
            <ModalHeader>Allow roles to start workspaces from non-imported repos</ModalHeader>
            <ModalBody>
                {props.isLoading ? (
                    <LoadingState />
                ) : (
                    VALID_ORG_MEMBER_ROLES.map((role) => (
                        <OrganizationRoleRestrictionSwitch
                            role={role}
                            checked={!restrictedRoles.includes(role)}
                            onCheckedChange={(checked) => {
                                console.log(role, { checked });
                                if (!checked) {
                                    setRestrictedClasses((prev) => [...prev, role]);
                                } else {
                                    setRestrictedClasses((prev) => prev.filter((r) => r !== role));
                                }
                            }}
                        />
                    ))
                )}
            </ModalBody>
            <ModalBaseFooter className="justify-between">
                <div className="flex gap-2">
                    <Button variant="secondary" onClick={onClose}>
                        Cancel
                    </Button>
                    <LoadingButton disabled={props.isLoading} type="submit" loading={updateMutation.isLoading}>
                        Save
                    </LoadingButton>
                </div>
            </ModalBaseFooter>
        </Modal>
    );
};

interface OrganizationRoleRestrictionSwitchProps {
    role: string;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
}
const OrganizationRoleRestrictionSwitch = ({
    role,
    checked,
    onCheckedChange,
}: OrganizationRoleRestrictionSwitchProps) => {
    return (
        <div className={cn("flex w-full capitalize justify-between items-center mt-2")}>
            <SwitchInputField key={role} id={role} label={role} checked={checked} onCheckedChange={onCheckedChange} />
        </div>
    );
};
