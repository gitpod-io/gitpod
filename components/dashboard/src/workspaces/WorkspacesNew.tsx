/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FunctionComponent, useCallback, useMemo, useState } from "react";
import Header from "../components/Header";
import { WorkspaceEntry } from "./WorkspaceEntryNew";
import { ItemsList } from "../components/ItemsList";
import { useCurrentUser } from "../user-context";
import { User } from "@gitpod/gitpod-protocol";
import SelectIDEModal from "../settings/SelectIDEModal";
import Arrow from "../components/Arrow";
import ConfirmationModal from "../components/ConfirmationModal";
import { ProfileState } from "../settings/ProfileInformation";
import { useWorkspaces } from "../data/workspaces/queries";
import { EmptyWorkspacesContent } from "./EmptyWorkspacesContent";
import { WorkspacesSearchBar } from "./WorkspacesSearchBar";

const WorkspacesPage: FunctionComponent = () => {
    const user = useCurrentUser();
    const [limit, setLimit] = useState(50);
    const [searchTerm, setSearchTerm] = useState("");

    const [showInactive, setShowInactive] = useState(false);
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);

    const { data, isLoading } = useWorkspaces({ limit });

    const isOnboardingUser = useMemo(() => user && User.isOnboardingUser(user), [user]);

    const deleteInactiveWorkspaces = useCallback(() => {
        // TODO: Add mutation for deleting a workspace
        console.log("delete inactive workspaces", data?.inactive);
        // workspaceModel?.deleteWorkspace(ws.workspace.id, usePublicApiWorkspacesService),
        setDeleteModalVisible(false);
    }, [data?.inactive]);

    const activeWorkspaces = data?.active || [];
    const inactiveWorkspaces = data?.inactive || [];
    // TODO: Add memoized filtered (by searchTerm) sets for data.active and data.inactive

    return (
        <>
            <Header title="Workspaces" subtitle="Manage recent and stopped workspaces." />

            <ConfirmationModal
                title="Delete Inactive Workspaces"
                areYouSureText="Are you sure you want to delete all inactive workspaces?"
                buttonText="Delete Inactive Workspaces"
                visible={!!deleteModalVisible}
                onClose={() => setDeleteModalVisible(false)}
                onConfirm={deleteInactiveWorkspaces}
            />

            {isOnboardingUser ? (
                <SelectIDEModal location={"workspace_list"} />
            ) : (
                // modal hides itself
                <ProfileState.NudgeForProfileUpdateModal />
            )}

            {!isLoading &&
                (activeWorkspaces.length > 0 || inactiveWorkspaces.length > 0 || searchTerm ? (
                    <>
                        <WorkspacesSearchBar
                            limit={limit}
                            searchTerm={searchTerm}
                            onLimitUpdated={setLimit}
                            onSearchTermUpdated={setSearchTerm}
                        />
                        <ItemsList className="app-container pb-40">
                            <div className="border-t border-gray-200 dark:border-gray-800"></div>
                            {activeWorkspaces.map((info) => {
                                return <WorkspaceEntry key={info.workspace.id} info={info} />;
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
                                            {inactiveWorkspaces.map((info) => {
                                                return <WorkspaceEntry key={info.workspace.id} info={info} />;
                                            })}
                                        </>
                                    ) : null}
                                </div>
                            )}
                        </ItemsList>
                    </>
                ) : (
                    <EmptyWorkspacesContent />
                ))}
        </>
    );
};

export default WorkspacesPage;
