/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FunctionComponent, useCallback, useMemo, useState } from "react";
import Header from "../components/Header";
import { WorkspaceEntry } from "./WorkspaceEntry";
import { ItemsList } from "../components/ItemsList";
import { WorkspaceInfo } from "@gitpod/gitpod-protocol";
import Arrow from "../components/Arrow";
import ConfirmationModal from "../components/ConfirmationModal";
import { useListWorkspacesQuery } from "../data/workspaces/list-workspaces-query";
import { EmptyWorkspacesContent } from "./EmptyWorkspacesContent";
import { WorkspacesSearchBar } from "./WorkspacesSearchBar";
import { hoursBefore, isDateSmallerOrEqual } from "@gitpod/gitpod-protocol/lib/util/timeutil";
import { useDeleteInactiveWorkspacesMutation } from "../data/workspaces/delete-inactive-workspaces-mutation";
import { useToast } from "../components/toasts/Toasts";

const WorkspacesPage: FunctionComponent = () => {
    const [limit, setLimit] = useState(50);
    const [searchTerm, setSearchTerm] = useState("");
    const [showInactive, setShowInactive] = useState(false);
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const { data, isLoading } = useListWorkspacesQuery({ limit });
    const deleteInactiveWorkspaces = useDeleteInactiveWorkspacesMutation();
    const { toast } = useToast();

    // Sort workspaces into active/inactive groups
    const { activeWorkspaces, inactiveWorkspaces } = useMemo(() => {
        const sortedWorkspaces = (data || []).sort(sortWorkspaces);
        const activeWorkspaces = sortedWorkspaces.filter((ws) => isWorkspaceActive(ws));

        // respecting the limit, return inactive workspaces as well
        const inactiveWorkspaces = sortedWorkspaces
            .filter((ws) => !isWorkspaceActive(ws))
            .slice(0, limit - activeWorkspaces.length);

        return {
            activeWorkspaces,
            inactiveWorkspaces,
        };
    }, [data, limit]);

    const { filteredActiveWorkspaces, filteredInactiveWorkspaces } = useMemo(() => {
        const filteredActiveWorkspaces = activeWorkspaces.filter(
            (info) =>
                `${info.workspace.description}${info.workspace.id}${info.workspace.contextURL}${info.workspace.context}`
                    .toLowerCase()
                    .indexOf(searchTerm.toLowerCase()) !== -1,
        );

        const filteredInactiveWorkspaces = inactiveWorkspaces.filter(
            (info) =>
                `${info.workspace.description}${info.workspace.id}${info.workspace.contextURL}${info.workspace.context}`
                    .toLowerCase()
                    .indexOf(searchTerm.toLowerCase()) !== -1,
        );

        return {
            filteredActiveWorkspaces,
            filteredInactiveWorkspaces,
        };
    }, [activeWorkspaces, inactiveWorkspaces, searchTerm]);

    const handleDeleteInactiveWorkspacesConfirmation = useCallback(async () => {
        try {
            await deleteInactiveWorkspaces.mutateAsync({
                workspaceIds: inactiveWorkspaces.map((info) => info.workspace.id),
            });

            setDeleteModalVisible(false);
            toast("Your workspace was deleted");
        } catch (e) {}
    }, [deleteInactiveWorkspaces, inactiveWorkspaces, toast]);

    return (
        <>
            <Header title="Workspaces" subtitle="Manage recent and stopped workspaces." />

            {deleteModalVisible && (
                <ConfirmationModal
                    title="Delete Inactive Workspaces"
                    areYouSureText="Are you sure you want to delete all inactive workspaces?"
                    buttonText="Delete Inactive Workspaces"
                    onClose={() => setDeleteModalVisible(false)}
                    onConfirm={handleDeleteInactiveWorkspacesConfirmation}
                    visible
                />
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
                            {filteredActiveWorkspaces.map((info) => {
                                return <WorkspaceEntry key={info.workspace.id} info={info} />;
                            })}
                            {filteredActiveWorkspaces.length > 0 && <div className="py-6"></div>}
                            {filteredInactiveWorkspaces.length > 0 && (
                                <div>
                                    <div
                                        onClick={() => setShowInactive(!showInactive)}
                                        className="flex cursor-pointer py-6 px-6 flex-row text-gray-400 bg-gray-50  hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-xl mb-2"
                                    >
                                        <div className="pr-2">
                                            <Arrow direction={showInactive ? "down" : "right"} />
                                        </div>
                                        <div className="flex flex-grow flex-col ">
                                            <div className="font-medium text-gray-500 dark:text-gray-200 truncate">
                                                <span>Inactive Workspaces&nbsp;</span>
                                                <span className="text-gray-400 dark:text-gray-400 bg-gray-200 dark:bg-gray-600 rounded-xl px-2 py-0.5 text-xs">
                                                    {filteredInactiveWorkspaces.length}
                                                </span>
                                            </div>
                                            <div className="text-sm flex-auto">
                                                Workspaces that have been stopped for more than 24 hours. Inactive
                                                workspaces are automatically deleted after 14 days.{" "}
                                                <a
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="gp-link"
                                                    href="https://www.gitpod.io/docs/configure/workspaces/workspace-lifecycle#workspace-deletion"
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
                                            {filteredInactiveWorkspaces.map((info) => {
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

const sortWorkspaces = (a: WorkspaceInfo, b: WorkspaceInfo) => {
    const result = workspaceActiveDate(b).localeCompare(workspaceActiveDate(a));
    if (result === 0) {
        // both active now? order by creationtime
        return WorkspaceInfo.lastActiveISODate(b).localeCompare(WorkspaceInfo.lastActiveISODate(a));
    }
    return result;
};

/**
 * Given a WorkspaceInfo, return a timestamp of the last related activitiy
 *
 * @param info WorkspaceInfo
 * @returns string timestamp
 */
function workspaceActiveDate(info: WorkspaceInfo): string {
    if (!info.latestInstance) {
        return info.workspace.creationTime;
    }
    if (info.latestInstance.status.phase === "stopped" || info.latestInstance.status.phase === "unknown") {
        return WorkspaceInfo.lastActiveISODate(info);
    }

    const now = new Date().toISOString();
    return info.latestInstance.stoppedTime || info.latestInstance.stoppingTime || now;
}

/**
 * Returns a boolean indicating if the workspace should be considered active.
 * A workspace is considered active if it is pinned, not stopped, or was active within the last 24 hours
 *
 * @param info WorkspaceInfo
 * @returns boolean If workspace is considered active
 */
function isWorkspaceActive(info: WorkspaceInfo): boolean {
    const lastSessionStart = WorkspaceInfo.lastActiveISODate(info);
    const twentyfourHoursAgo = hoursBefore(new Date().toISOString(), 24);

    return (
        (info.workspace.pinned ||
            (!!info.latestInstance && info.latestInstance.status?.phase !== "stopped") ||
            isDateSmallerOrEqual(twentyfourHoursAgo, lastSessionStart)) &&
        !info.workspace.softDeleted
    );
}
