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
import { useToggleWorkspacedPinnedMutation } from "../data/workspaces/toggle-workspace-pinned-mutation";
import { useToggleWorkspaceSharedMutation } from "../data/workspaces/toggle-workspace-shared-mutation";
import { getGitpodService } from "../service/service";
import ConnectToSSHModal from "./ConnectToSSHModal";
import { DeleteWorkspaceModal } from "./DeleteWorkspaceModal";
import { useToast } from "../components/toasts/Toasts";
import { RenameWorkspaceModal } from "./RenameWorkspaceModal";
import { AdmissionLevel, Workspace, WorkspacePhase_Phase } from "@gitpod/public-api/lib/gitpod/v1/workspace_pb";

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

    const stopWorkspace = useStopWorkspaceMutation();
    const toggleWorkspaceShared = useToggleWorkspaceSharedMutation();
    const toggleWorkspacePinned = useToggleWorkspacedPinnedMutation();

    const workspace = info;
    const state: WorkspacePhase_Phase = info?.status?.phase?.name || WorkspacePhase_Phase.STOPPED;

    //TODO: shift this into ConnectToSSHModal
    const handleConnectViaSSHClick = useCallback(async () => {
        const ot = await getGitpodService().server.getOwnerToken(workspace.id);
        setOwnerToken(ot);
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
            workspace.status?.admission === AdmissionLevel.EVERYONE
                ? AdmissionLevel.OWNER_ONLY
                : AdmissionLevel.EVERYONE;

        toggleWorkspaceShared.mutate({
            workspaceId: workspace.id,
            level: newLevel,
        });
    }, [toggleWorkspaceShared, workspace.id, workspace.status?.admission]);

    const togglePinned = useCallback(() => {
        toggleWorkspacePinned.mutate({
            workspaceId: workspace.id,
        });
    }, [toggleWorkspacePinned, workspace.id]);

    // Can we use `/start#${workspace.id}` instead?
    const startUrl = useMemo(
        () =>
            new GitpodHostUrl(window.location.href).with({
                pathname: "/start/",
                hash: `#${workspace.id}`,
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
        {
            title: "Rename",
            href: "",
            onClick: () => setRenameModalVisible(true),
        },
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

    menuEntries.push(
        {
            title: "Share",
            active: workspace.status?.admission === AdmissionLevel.EVERYONE,
            onClick: toggleShared,
        },
        {
            title: "Pin",
            active: !!workspace.pinned,
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
