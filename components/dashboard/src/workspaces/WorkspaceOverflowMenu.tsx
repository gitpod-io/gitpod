/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { GitpodHostUrl } from "@gitpod/gitpod-protocol/lib/util/gitpod-host-url";
import { FunctionComponent, useCallback, useMemo, useState } from "react";
import { ContextMenuEntry } from "../components/ContextMenu";
import { ItemFieldContextMenu } from "../components/ItemsList";
import { useStopWorkspaceMutation } from "../data/workspaces/stop-workspace-mutation";
import ConnectToSSHModal from "./ConnectToSSHModal";
import { DeleteWorkspaceModal } from "./DeleteWorkspaceModal";
import { useToast } from "../components/toasts/Toasts";
import { RenameWorkspaceModal } from "./RenameWorkspaceModal";
import { AdmissionLevel, Workspace, WorkspacePhase_Phase } from "@gitpod/public-api/lib/gitpod/v1/workspace_pb";
import { workspaceClient } from "../service/public-api";
import { useOrgSettingsQuery } from "../data/organizations/org-settings-query";
import { useUpdateWorkspaceMutation } from "../data/workspaces/update-workspace-mutation";

type WorkspaceEntryOverflowMenuProps = {
    info: Workspace;
    changeMenuState: (state: boolean) => void;
};

export const WorkspaceEntryOverflowMenu: FunctionComponent<WorkspaceEntryOverflowMenuProps> = ({
    info,
    changeMenuState,
}) => {
    const [isDeleteModalVisible, setDeleteModalVisible] = useState(false);
    const [isRenameModalVisible, setRenameModalVisible] = useState(false);
    const [isSSHModalVisible, setSSHModalVisible] = useState(false);
    const [ownerToken, setOwnerToken] = useState("");
    const { toast } = useToast();
    const { data: settings } = useOrgSettingsQuery();

    const stopWorkspace = useStopWorkspaceMutation();
    const updateWorkspace = useUpdateWorkspaceMutation();

    const workspace = info;
    const state: WorkspacePhase_Phase = info?.status?.phase?.name || WorkspacePhase_Phase.STOPPED;

    //TODO: shift this into ConnectToSSHModal
    const handleConnectViaSSHClick = useCallback(async () => {
        const response = await workspaceClient.getWorkspaceOwnerToken({ workspaceId: workspace.id });
        setOwnerToken(response.ownerToken);
        setSSHModalVisible(true);
    }, [workspace.id]);

    const handleStopWorkspace = useCallback(() => {
        stopWorkspace.mutate(
            { workspaceId: workspace.id },
            {
                onError: (error: any) => {
                    toast(error.message || "Failed to stop workspace");
                },
            },
        );
    }, [toast, stopWorkspace, workspace.id]);

    const toggleShared = useCallback(() => {
        const newLevel =
            workspace.spec?.admission === AdmissionLevel.EVERYONE ? AdmissionLevel.OWNER_ONLY : AdmissionLevel.EVERYONE;

        updateWorkspace.mutate({
            workspaceId: workspace.id,
            spec: {
                admission: newLevel,
            },
        });
    }, [updateWorkspace, workspace.id, workspace.spec?.admission]);

    const togglePinned = useCallback(() => {
        updateWorkspace.mutate({
            workspaceId: workspace.id,
            metadata: {
                pinned: !workspace.metadata?.pinned,
            },
        });
    }, [updateWorkspace, workspace.id, workspace.metadata?.pinned]);

    // Can we use `/start#${workspace.id}` instead?
    const startUrl = useMemo(
        () =>
            new GitpodHostUrl(window.location.href).with({
                pathname: "/start/",
                hash: "#" + workspace.id,
            }),
        [workspace.id],
    );

    // Can we use `/workspace-download/get/${workspace.id}` instead?
    const downloadURL = useMemo(
        () =>
            new GitpodHostUrl(window.location.href)
                .with({
                    pathname: `/workspace-download/get/${workspace.id}`,
                })
                .toString(),
        [workspace.id],
    );

    const menuEntries: ContextMenuEntry[] = [
        {
            title: "Open",
            href: startUrl.toString(),
        },
        // {
        //     title: "Rename",
        //     href: "",
        //     onClick: () => setRenameModalVisible(true),
        // },
    ];

    if (state === WorkspacePhase_Phase.RUNNING) {
        menuEntries.push({
            title: "Stop",
            onClick: handleStopWorkspace,
        });
        menuEntries.splice(1, 0, {
            title: "Connect via SSH",
            onClick: handleConnectViaSSHClick,
        });
    }

    menuEntries.push({
        title: "Download",
        href: downloadURL,
        download: `${workspace.id}.tar`,
    });

    // Push the Workspace share menu entry based on the current organization settings for workspace sharing
    if (settings && !settings.workspaceSharingDisabled) {
        menuEntries.push({
            title: "Share",
            active: workspace.spec?.admission === AdmissionLevel.EVERYONE,
            onClick: toggleShared,
        });
    } else {
        menuEntries.push({
            title: "Workspace sharing is disabled for this organization. Contact your org. owner to enable it.",
            active: false,
            customContent: "Share",
            customFontStyle: "text-gray-400 dark:text-gray-500 opacity-50 cursor-not-allowed",
        });
    }

    menuEntries.push(
        {
            title: "Pin",
            active: !!workspace.metadata?.pinned,
            separator: true,
            onClick: togglePinned,
        },
        {
            title: "Delete",
            customFontStyle: "text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300",
            onClick: () => setDeleteModalVisible(true),
        },
    );

    return (
        <>
            <ItemFieldContextMenu changeMenuState={changeMenuState} menuEntries={menuEntries} />
            {isDeleteModalVisible && (
                <DeleteWorkspaceModal workspace={workspace} onClose={() => setDeleteModalVisible(false)} />
            )}
            {isRenameModalVisible && (
                <RenameWorkspaceModal workspace={workspace} onClose={() => setRenameModalVisible(false)} />
            )}
            {isSSHModalVisible && info.status && ownerToken !== "" && (
                <ConnectToSSHModal
                    workspaceId={workspace.id}
                    ownerToken={ownerToken}
                    ideUrl={info.status.workspaceUrl.replaceAll("https://", "")}
                    onClose={() => {
                        setSSHModalVisible(false);
                        setOwnerToken("");
                    }}
                />
            )}
        </>
    );
};
