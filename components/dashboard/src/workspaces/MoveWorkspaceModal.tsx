/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Organization, Workspace } from "@gitpod/gitpod-protocol";
import { FunctionComponent, useState } from "react";
import { DropDown2 } from "../components/DropDown2";
import Modal, { ModalBody, ModalFooter, ModalHeader } from "../components/Modal";
import { OrgIcon } from "../components/org-icon/OrgIcon";
import { useCurrentOrg, useOrganizations } from "../data/organizations/orgs-query";
import { useMoveWorkspaceMutation } from "../data/workspaces/move-workspace-mutation";
import { useCurrentUser } from "../user-context";

type Props = {
    workspace: Workspace;
    onClose(): void;
};

export function useCanMoveWorkspace(): boolean {
    const user = useCurrentUser();
    const currentOrg = useCurrentOrg();
    const orgs = useOrganizations();
    return !!(
        orgs.data &&
        orgs.data.length > 1 &&
        currentOrg.data?.members.some((m) => m.userId === user?.id && m.role === "owner")
    );
}

export const MoveWorkspaceModal: FunctionComponent<Props> = ({ workspace, onClose }) => {
    const orgs = useOrganizations();
    const currentOrg = useCurrentOrg();
    const [targetOrganizationId, setTargetOrganizationId] = useState(workspace.description || "");
    const moveWorkspaceMutation = useMoveWorkspaceMutation();

    const selectableOrgs = orgs.data?.filter((org) => org.id !== currentOrg.data?.id) || [];

    const moveWorkspace = async () => {
        try {
            await moveWorkspaceMutation.mutateAsync({ workspaceId: workspace.id, targetOrganizationId });
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <Modal
            visible
            onClose={onClose}
            onEnter={async () => {
                await moveWorkspace();
                return true;
            }}
        >
            <ModalHeader>Move Workspace</ModalHeader>
            <ModalBody noScroll={true}>
                <DropDown2
                    getElements={() =>
                        selectableOrgs.map((o) => {
                            return {
                                id: o.id,
                                element: renderOrganization(o),
                                isSelectable: true,
                            };
                        })
                    }
                    onSelectionChange={setTargetOrganizationId}
                    searchPlaceholder="Select Target Organization"
                    disableSearch={true}
                >
                    {renderOrganization(orgs.data?.find((o) => o.id === targetOrganizationId))}
                </DropDown2>
                <div className="mt-3 py-2 whitespace-normal">
                    <p className="text-gray-500">This moves the workspace to the selected organization.</p>
                    <p className="text-gray-500">
                        Please note, that past workspace sessions are not moved and are still listed as usage of the
                        current organization.
                    </p>
                </div>
            </ModalBody>
            <ModalFooter>
                <button disabled={moveWorkspaceMutation.isLoading} className="secondary" onClick={onClose}>
                    Cancel
                </button>
                <button
                    disabled={moveWorkspaceMutation.isLoading}
                    className="ml-2"
                    type="submit"
                    onClick={async () => {
                        await moveWorkspace();
                        onClose();
                    }}
                >
                    Move Workspace
                </button>
            </ModalFooter>
        </Modal>
    );
};

function renderOrganization(o?: Organization) {
    return (
        <div className="px-2 py-1 flex font-semibold whitespace-nowrap max-w-xs overflow-hidden">
            {o ? (
                <>
                    <OrgIcon id={o?.id} name={o.name} size="small" className="mr-2" />
                    {o.name}
                </>
            ) : (
                <>Select target organization</>
            )}
        </div>
    );
}
