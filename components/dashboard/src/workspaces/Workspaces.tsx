/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
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

export interface WorkspacesProps {}

export interface WorkspacesState {
    workspaces: WorkspaceInfo[];
    isTemplateModelOpen: boolean;
    repos: WhitelistedRepository[];
}

export default function () {
    const location = useLocation();

    const { user } = useContext(UserContext);
    const { teams } = useContext(TeamsContext);
    const [activeWorkspaces, setActiveWorkspaces] = useState<WorkspaceInfo[]>([]);
    const [inactiveWorkspaces, setInactiveWorkspaces] = useState<WorkspaceInfo[]>([]);
    const [workspaceModel, setWorkspaceModel] = useState<WorkspaceModel>();
    const [hasWorkspaces, setHasWorkspaces] = useState(false);
    const { setIsStartWorkspaceModalVisible, isStartWorkspaceModalVisible } = useContext(StartWorkspaceModalContext);

    useEffect(() => {
        (async () => {
            const workspaceModel = new WorkspaceModel(setActiveWorkspaces, setInactiveWorkspaces);
            setWorkspaceModel(workspaceModel);
        })();
    }, [teams, location]);

    useEffect(() => {
        setHasWorkspaces(!!activeWorkspaces.length || !!inactiveWorkspaces.length);
    }, [activeWorkspaces, inactiveWorkspaces]);

    const isOnboardingUser = user && User.isOnboardingUser(user);

    return (
        <>
            <Header title="Workspaces" subtitle="Manage recent and stopped workspaces." />

            {workspaceModel?.initialized && (
                <>
                    {isOnboardingUser && !hasWorkspaces && !isStartWorkspaceModalVisible && <SelectIDEModal />}
                    {hasWorkspaces || workspaceModel?.searchTerm ? (
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
                                        contextMenuWidth="w-32"
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
                                <button onClick={() => setIsStartWorkspaceModalVisible(true)} className="ml-2">
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
                                            stopWorkspace={(wsId) => getGitpodService().server.stopWorkspace(wsId)}
                                        />
                                    );
                                })}
                                {activeWorkspaces.length > 0 && <div className="py-6"></div>}
                                {inactiveWorkspaces.length > 0 && (
                                    <div className="p-3 text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-xl text-sm text-center">
                                        Unpinned workspaces that have been inactive for more than 14 days will be
                                        automatically deleted.{" "}
                                        <a
                                            className="gp-link"
                                            href="https://www.gitpod.io/docs/life-of-workspace/#garbage-collection"
                                        >
                                            Learn more
                                        </a>
                                    </div>
                                )}
                                {inactiveWorkspaces.map((e) => {
                                    return (
                                        <WorkspaceEntry
                                            key={e.workspace.id}
                                            desc={e}
                                            model={workspaceModel}
                                            stopWorkspace={(wsId) => getGitpodService().server.stopWorkspace(wsId)}
                                        />
                                    );
                                })}
                            </ItemsList>
                        </>
                    ) : (
                        <div className="app-container flex flex-col space-y-2">
                            <div className="px-6 py-3 flex flex-col text-gray-400 border-t border-gray-200 dark:border-gray-800">
                                <div className="flex flex-col items-center justify-center h-96 w-96 mx-auto">
                                    <>
                                        <h3 className="text-center pb-3 text-gray-500 dark:text-gray-400">
                                            No Workspaces
                                        </h3>
                                        <div className="text-center pb-6 text-gray-500">
                                            Prefix any Git repository URL with {window.location.host}/# or create a new
                                            workspace for a recently used project.{" "}
                                            <a className="gp-link" href="https://www.gitpod.io/docs/getting-started/">
                                                Learn more
                                            </a>
                                        </div>
                                        <span>
                                            <button onClick={() => setIsStartWorkspaceModalVisible(true)}>
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
                    )}
                </>
            )}
        </>
    );
}
