/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import {
    CommitContext,
    Workspace,
    WorkspaceInfo,
    WorkspaceInstance,
    WorkspaceInstanceConditions,
    WorkspaceInstancePhase,
    ContextURL,
} from "@gitpod/gitpod-protocol";
import { GitpodHostUrl } from "@gitpod/gitpod-protocol/lib/util/gitpod-host-url";
import { useRef, useState } from "react";
import ConfirmationModal from "../components/ConfirmationModal";
import Modal from "../components/Modal";
import { ContextMenuEntry } from "../components/ContextMenu";
import { Item, ItemField, ItemFieldContextMenu, ItemFieldIcon } from "../components/ItemsList";
import PendingChangesDropdown from "../components/PendingChangesDropdown";
import Tooltip from "../components/Tooltip";
import { WorkspaceModel } from "./workspace-model";
import { getGitpodService } from "../service/service";
import ConnectToSSHModal from "./ConnectToSSHModal";
import dayjs from "dayjs";

function getLabel(state: WorkspaceInstancePhase, conditions?: WorkspaceInstanceConditions) {
    if (conditions?.failed) {
        return "Failed";
    }
    return state.substr(0, 1).toLocaleUpperCase() + state.substr(1);
}

interface Props {
    desc: WorkspaceInfo;
    model: WorkspaceModel;
    isAdmin?: boolean;
    stopWorkspace: (ws: string) => Promise<void>;
}

export function WorkspaceEntry({ desc, model, isAdmin, stopWorkspace }: Props) {
    const [isDeleteModalVisible, setDeleteModalVisible] = useState(false);
    const [isRenameModalVisible, setRenameModalVisible] = useState(false);
    const [isSSHModalVisible, setSSHModalVisible] = useState(false);
    const renameInputRef = useRef<HTMLInputElement>(null);
    const [errorMessage, setErrorMessage] = useState("");
    const state: WorkspaceInstancePhase = desc.latestInstance?.status?.phase || "stopped";
    const currentBranch =
        desc.latestInstance?.status.repo?.branch || Workspace.getBranchName(desc.workspace) || "<unknown>";
    const ws = desc.workspace;
    const [workspaceDescription, setWsDescription] = useState(ws.description);
    const [ownerToken, setOwnerToken] = useState("");

    const startUrl = new GitpodHostUrl(window.location.href).with({
        pathname: "/start/",
        hash: "#" + ws.id,
    });
    const menuEntries: ContextMenuEntry[] = [
        {
            title: "Open",
            href: startUrl.toString(),
        },
        {
            title: "Rename",
            href: "",
            onClick: () => {
                setRenameModalVisible(true);
            },
        },
    ];
    if (state === "running") {
        menuEntries.push({
            title: "Stop",
            onClick: () => stopWorkspace(ws.id),
        });
        menuEntries.splice(1, 0, {
            title: "Connect via SSH",
            onClick: async () => {
                const ot = await getGitpodService().server.getOwnerToken(ws.id);
                setOwnerToken(ot);
                setSSHModalVisible(true);
            },
        });
    }
    menuEntries.push({
        title: "Download",
        customContent: (
            <div className="">
                <span className="block text-gray-300">Download</span>
                <span className="text-gray-400">
                    Deprecated.{" "}
                    <a
                        href="https://github.com/gitpod-io/gitpod/issues/7901"
                        className="gp-link"
                        target="_blank"
                        rel="noreferrer"
                    >
                        Learn more
                    </a>
                </span>
            </div>
        ),
    });
    if (!isAdmin) {
        menuEntries.push(
            {
                title: "Share",
                active: !!ws.shareable,
                onClick: () => {
                    model.toggleShared(ws.id);
                },
            },
            {
                title: "Pin",
                active: !!ws.pinned,
                separator: true,
                onClick: () => {
                    model.togglePinned(ws.id);
                },
            },
            {
                title: "Delete",
                customFontStyle: "text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300",
                onClick: () => {
                    setDeleteModalVisible(true);
                },
            },
        );
    }
    const project = getProject(ws);

    const updateWorkspaceDescription = async () => {
        // Need this check because ref is called twice
        // https://reactjs.org/docs/refs-and-the-dom.html#caveats-with-callback-refs
        if (!renameInputRef.current) {
            return;
        }

        try {
            if (renameInputRef.current!.value.length === 0) {
                setErrorMessage("Description cannot not be empty.");
                return false;
            }

            if (renameInputRef.current!.value.length > 250) {
                setErrorMessage("Description is too long for readability.");
                return false;
            }

            setWsDescription(renameInputRef.current!.value);
            await getGitpodService().server.setWorkspaceDescription(ws.id, renameInputRef.current!.value);
            setErrorMessage("");
            setRenameModalVisible(false);
        } catch (error) {
            console.error(error);
            window.alert("Something went wrong. Please try renaming again.");
        }
    };

    const normalizedContextUrl = ContextURL.getNormalizedURL(ws)?.toString();
    const normalizedContextUrlDescription = normalizedContextUrl || ws.contextURL; // Instead of showing nothing, we prefer to show the raw content instead
    return (
        <Item className="whitespace-nowrap py-6 px-6">
            <ItemFieldIcon>
                <WorkspaceStatusIndicator instance={desc?.latestInstance} />
            </ItemFieldIcon>
            <ItemField className="w-3/12 flex flex-col my-auto">
                <a href={startUrl.toString()}>
                    <div className="font-medium text-gray-800 dark:text-gray-200 truncate hover:text-blue-600 dark:hover:text-blue-400">
                        {ws.id}
                    </div>
                </a>
                <Tooltip content={project ? "https://" + project : ""} allowWrap={true}>
                    <a href={project ? "https://" + project : undefined}>
                        <div className="text-sm overflow-ellipsis truncate text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400">
                            {project || "Unknown"}
                        </div>
                    </a>
                </Tooltip>
            </ItemField>
            <ItemField className="w-4/12 flex flex-col my-auto">
                <div className="text-gray-500 dark:text-gray-400 overflow-ellipsis truncate">
                    {workspaceDescription}
                </div>
                <a href={normalizedContextUrl}>
                    <div className="text-sm text-gray-400 dark:text-gray-500 overflow-ellipsis truncate hover:text-blue-600 dark:hover:text-blue-400">
                        {normalizedContextUrlDescription}
                    </div>
                </a>
            </ItemField>
            <ItemField className="w-2/12 flex flex-col my-auto">
                <div className="text-gray-500 dark:text-gray-400 overflow-ellipsis truncate">{currentBranch}</div>
                <div className="mr-auto">
                    <PendingChangesDropdown workspaceInstance={desc.latestInstance} />
                </div>
            </ItemField>
            <ItemField className="w-2/12 flex my-auto">
                <Tooltip content={`Created ${dayjs(desc.workspace.creationTime).fromNow()}`}>
                    <div className="text-sm w-full text-gray-400 overflow-ellipsis truncate">
                        {dayjs(WorkspaceInfo.lastActiveISODate(desc)).fromNow()}
                    </div>
                </Tooltip>
            </ItemField>
            <ItemFieldContextMenu menuEntries={menuEntries} />
            {isDeleteModalVisible && (
                <ConfirmationModal
                    title="Delete Workspace"
                    areYouSureText="Are you sure you want to delete this workspace?"
                    children={{
                        name: ws.id,
                        description: ws.description,
                    }}
                    buttonText="Delete Workspace"
                    visible={isDeleteModalVisible}
                    onClose={() => setDeleteModalVisible(false)}
                    onConfirm={() => model.deleteWorkspace(ws.id)}
                />
            )}
            {/* TODO: Use title and buttons props */}
            <Modal
                visible={isRenameModalVisible}
                onClose={() => setRenameModalVisible(false)}
                onEnter={() => {
                    updateWorkspaceDescription();
                    return isRenameModalVisible;
                }}
            >
                <h3 className="mb-4">Rename Workspace Description</h3>
                <div className="border-t border-b border-gray-200 dark:border-gray-800 -mx-6 px-6 py-4 space-y-2">
                    {errorMessage.length > 0 ? (
                        <div className="bg-gitpod-kumquat-light rounded-md p-3 text-gitpod-red text-sm mb-2">
                            {errorMessage}
                        </div>
                    ) : null}
                    <input
                        autoFocus
                        className="w-full truncate"
                        type="text"
                        defaultValue={workspaceDescription}
                        ref={renameInputRef}
                    />
                    <div className="mt-1">
                        <p className="text-gray-500">
                            Change the description to make it easier to go back to a workspace.
                        </p>
                        <p className="text-gray-500">Workspace URLs and endpoints will remain the same.</p>
                    </div>
                </div>
                <div className="flex justify-end mt-6">
                    <button className="secondary" onClick={() => setRenameModalVisible(false)}>
                        Cancel
                    </button>
                    <button className="ml-2" type="submit" onClick={updateWorkspaceDescription}>
                        Update Description
                    </button>
                </div>
            </Modal>
            {isSSHModalVisible && desc.latestInstance && ownerToken !== "" && (
                <ConnectToSSHModal
                    workspaceId={ws.id}
                    ownerToken={ownerToken}
                    ideUrl={desc.latestInstance.ideUrl.replaceAll("https://", "")}
                    onClose={() => {
                        setSSHModalVisible(false);
                        setOwnerToken("");
                    }}
                />
            )}
        </Item>
    );
}

export function getProject(ws: Workspace) {
    if (CommitContext.is(ws.context)) {
        return `${ws.context.repository.host}/${ws.context.repository.owner}/${ws.context.repository.name}`;
    } else {
        return undefined;
    }
}

export function WorkspaceStatusIndicator({ instance }: { instance?: WorkspaceInstance }) {
    const state: WorkspaceInstancePhase = instance?.status?.phase || "stopped";
    const conditions = instance?.status?.conditions;
    let stateClassName = "rounded-full w-3 h-3 text-sm align-middle";
    switch (state) {
        case "running": {
            stateClassName += " bg-green-500";
            break;
        }
        case "stopped": {
            if (conditions?.failed) {
                stateClassName += " bg-red-400";
            } else {
                stateClassName += " bg-gray-400";
            }
            break;
        }
        case "interrupted": {
            stateClassName += " bg-red-400";
            break;
        }
        case "unknown": {
            stateClassName += " bg-red-400";
            break;
        }
        default: {
            stateClassName += " bg-gitpod-kumquat animate-pulse";
            break;
        }
    }
    return (
        <div className="m-auto">
            <Tooltip content={getLabel(state, conditions)}>
                <div className={stateClassName} />
            </Tooltip>
        </div>
    );
}
