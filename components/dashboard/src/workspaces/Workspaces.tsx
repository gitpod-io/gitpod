/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useContext, useEffect, useState } from "react";
import { WhitelistedRepository, WorkspaceInfo } from "@gitpod/gitpod-protocol";
import Header from "../components/Header";
import DropDown from "../components/DropDown";
import { WorkspaceModel } from "./workspace-model";
import { WorkspaceEntry } from "./WorkspaceEntry";
import { getGitpodService } from "../service/service";
import { ItemsList } from "../components/ItemsList";
import { TeamsContext } from "../teams/teams-context";
import { UserContext } from "../user-context";
import { User } from "@gitpod/gitpod-protocol";
import { useLocation } from "react-router";
import { StartWorkspaceModalContext, StartWorkspaceModalKeyBinding } from "./start-workspace-modal-context";
import SelectIDEModal from "../settings/SelectIDEModal";
import Arrow from "../components/Arrow";
import ConfirmationModal from "../components/ConfirmationModal";
import { ProfileState } from "../settings/ProfileInformation";
import { FeatureFlagContext } from "../contexts/FeatureFlagContext";
import { workspacesService } from "../service/public-api";

export interface WorkspacesProps {}

export interface WorkspacesState {
    workspaces: WorkspaceInfo[];
    isTemplateModelOpen: boolean;
    repos: WhitelistedRepository[];
    showInactive: boolean;
    deleteModalVisible: boolean;
}

export default function () {
    const location = useLocation();

    const { user } = useContext(UserContext);
    const { teams } = useContext(TeamsContext);
    const { usePublicApiWorkspacesService } = useContext(FeatureFlagContext);
    const [activeWorkspaces, setActiveWorkspaces] = useState<WorkspaceInfo[]>([]);
    const [inactiveWorkspaces, setInactiveWorkspaces] = useState<WorkspaceInfo[]>([]);
    const [workspaceModel, setWorkspaceModel] = useState<WorkspaceModel>();
    const [showInactive, setShowInactive] = useState<boolean>();
    const [deleteModalVisible, setDeleteModalVisible] = useState<boolean>();
    const { setStartWorkspaceModalProps } = useContext(StartWorkspaceModalContext);

    useEffect(() => {
        (async () => {
            const workspaceModel = new WorkspaceModel(setActiveWorkspaces, setInactiveWorkspaces);
            setWorkspaceModel(workspaceModel);
        })();
    }, [teams, location]);

    const isOnboardingUser = user && User.isOnboardingUser(user);

    return (
        <>
            <Header title="Workspaces" subtitle="Manage recent and stopped workspaces." />

            <ConfirmationModal
                title="Delete Inactive Workspaces"
                areYouSureText="Are you sure you want to delete all inactive workspaces?"
                buttonText="Delete Inactive Workspaces"
                visible={!!deleteModalVisible}
                onClose={() => setDeleteModalVisible(false)}
                onConfirm={() => {
                    inactiveWorkspaces.forEach((ws) =>
                        workspaceModel?.deleteWorkspace(ws.workspace.id, usePublicApiWorkspacesService),
                    );
                    setDeleteModalVisible(false);
                }}
            ></ConfirmationModal>

            {isOnboardingUser ? (
                <SelectIDEModal location={"workspace_list"} />
            ) : (
                // modal hides itself
                <ProfileState.NudgeForProfileUpdateModal />
            )}

            {workspaceModel?.initialized &&
                (activeWorkspaces.length > 0 || inactiveWorkspaces.length > 0 || workspaceModel.searchTerm ? (
                    <>
                        <div className="app-container py-2 flex">
                            <div className="flex">
                                <div className="py-4">
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        fill="none"
                                        viewBox="0 0 16 16"
                                        width="16"
                                        height="16"
                                    >
                                        <path
                                            fill="#A8A29E"
                                            d="M6 2a4 4 0 100 8 4 4 0 000-8zM0 6a6 6 0 1110.89 3.477l4.817 4.816a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 010 6z"
                                        />
                                    </svg>
                                </div>
                                <input
                                    type="search"
                                    className="text-sm"
                                    placeholder="Search Workspaces"
                                    onChange={(v) => {
                                        if (workspaceModel) workspaceModel.setSearch(v.target.value);
                                    }}
                                />
                            </div>
                            <div className="flex-1" />
                            <div className="py-3"></div>
                            <div className="py-3 pl-3">
                                <DropDown
                                    prefix="Limit: "
                                    customClasses="w-32"
                                    activeEntry={workspaceModel ? workspaceModel?.limit + "" : undefined}
                                    entries={[
                                        {
                                            title: "50",
                                            onClick: () => {
                                                if (workspaceModel) workspaceModel.limit = 50;
                                            },
                                        },
                                        {
                                            title: "100",
                                            onClick: () => {
                                                if (workspaceModel) workspaceModel.limit = 100;
                                            },
                                        },
                                        {
                                            title: "200",
                                            onClick: () => {
                                                if (workspaceModel) workspaceModel.limit = 200;
                                            },
                                        },
                                    ]}
                                />
                            </div>
                            <button onClick={() => setStartWorkspaceModalProps({})} className="ml-2">
                                New Workspace{" "}
                                <span className="opacity-60 hidden md:inline">{StartWorkspaceModalKeyBinding}</span>
                            </button>
                        </div>
                        <ItemsList className="app-container pb-40">
                            <div className="border-t border-gray-200 dark:border-gray-800"></div>
                            {activeWorkspaces.map((e) => {
                                return (
                                    <WorkspaceEntry
                                        key={e.workspace.id}
                                        desc={e}
                                        model={workspaceModel}
                                        stopWorkspace={(wsId) =>
                                            usePublicApiWorkspacesService
                                                ? workspacesService.stopWorkspace({ workspaceId: wsId })
                                                : getGitpodService().server.stopWorkspace(wsId)
                                        }
                                    />
                                );
                            })}
                            {activeWorkspaces.length > 0 && <div className="py-6"></div>}
                            {inactiveWorkspaces.length > 0 && (
                                <div>
                                    <div
                                        onClick={() => setShowInactive(!showInactive)}
                                        className="flex cursor-pointer py-6 px-6 flex-row text-gray-400 bg-gray-50  hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-xl mb-2"
                                    >
                                        <div className="pr-2">
                                            <Arrow direction={showInactive ? "up" : "down"} />
                                        </div>
                                        <div className="flex flex-grow flex-col ">
                                            <div className="font-medium text-gray-500 dark:text-gray-200 truncate">
                                                <span>Inactive Workspaces&nbsp;</span>
                                                <span className="text-gray-400 dark:text-gray-400 bg-gray-200 dark:bg-gray-600 rounded-xl px-2 py-0.5 text-xs">
                                                    {inactiveWorkspaces.length}
                                                </span>
                                            </div>
                                            <div className="text-sm flex-auto">
                                                Workspaces that have been stopped for more than 24 hours. Inactive
                                                workspaces are automatically deleted after 14 days.{" "}
                                                <a
                                                    className="gp-link"
                                                    href="https://www.gitpod.io/docs/life-of-workspace/#garbage-collection"
                                                    onClick={(evt) => evt.stopPropagation()}
                                                >
                                                    Learn more
                                                </a>
                                            </div>
                                        </div>
                                        <div className="self-center">
                                            {showInactive ? (
                                                <button
                                                    onClick={(evt) => {
                                                        setDeleteModalVisible(true);
                                                        evt.stopPropagation();
                                                    }}
                                                    className="secondary danger"
                                                >
                                                    Delete Inactive Workspaces
                                                </button>
                                            ) : null}
                                        </div>
                                    </div>
                                    {showInactive ? (
                                        <>
                                            {inactiveWorkspaces.map((e) => {
                                                return (
                                                    <WorkspaceEntry
                                                        key={e.workspace.id}
                                                        desc={e}
                                                        model={workspaceModel}
                                                        stopWorkspace={(wsId) =>
                                                            usePublicApiWorkspacesService
                                                                ? workspacesService.stopWorkspace({ workspaceId: wsId })
                                                                : getGitpodService().server.stopWorkspace(wsId)
                                                        }
                                                    />
                                                );
                                            })}
                                        </>
                                    ) : null}
                                </div>
                            )}
                        </ItemsList>
                    </>
                ) : (
                    <div className="app-container flex flex-col space-y-2">
                        <div className="px-6 py-3 flex flex-col text-gray-400 border-t border-gray-200 dark:border-gray-800">
                            <div className="flex flex-col items-center justify-center h-96 w-96 mx-auto">
                                <>
                                    <h3 className="text-center pb-3 text-gray-500 dark:text-gray-400">No Workspaces</h3>
                                    <div className="text-center pb-6 text-gray-500">
                                        Prefix any Git repository URL with {window.location.host}/# or create a new
                                        workspace for a recently used project.{" "}
                                        <a className="gp-link" href="https://www.gitpod.io/docs/getting-started/">
                                            Learn more
                                        </a>
                                    </div>
                                    <span>
                                        <button onClick={() => setStartWorkspaceModalProps({})}>
                                            New Workspace{" "}
                                            <span className="opacity-60 hidden md:inline">
                                                {StartWorkspaceModalKeyBinding}
                                            </span>
                                        </button>
                                    </span>
                                </>
                            </div>
                        </div>
                    </div>
                ))}
        </>
    );
}
