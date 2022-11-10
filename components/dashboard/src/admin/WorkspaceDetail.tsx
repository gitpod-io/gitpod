/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { User, WorkspaceAndInstance, ContextURL } from "@gitpod/gitpod-protocol";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getGitpodService } from "../service/service";
import { getProject, WorkspaceStatusIndicator } from "../workspaces/WorkspaceEntry";
import { getAdminLinks } from "./gcp-info";
import Property from "./Property";

export default function WorkspaceDetail(props: { workspace: WorkspaceAndInstance }) {
    const [workspace, setWorkspace] = useState(props.workspace);
    const [activity, setActivity] = useState(false);
    const [user, setUser] = useState<User>();
    useEffect(() => {
        getGitpodService().server.adminGetUser(props.workspace.ownerId).then(setUser);
    }, [props.workspace]);

    const stopWorkspace = async () => {
        try {
            setActivity(true);
            await getGitpodService().server.adminForceStopWorkspace(workspace.workspaceId);
            // let's reload in a sec
            setTimeout(reload, 2000);
        } finally {
            setActivity(false);
        }
    };

    const reload = async () => {
        try {
            setActivity(true);
            const ws = await getGitpodService().server.adminGetWorkspace(workspace.workspaceId);
            setWorkspace(ws);
        } finally {
            setActivity(false);
        }
    };

    const adminLinks = getAdminLinks(workspace);
    const adminLink = (i: number) => (
        <Property key={"admin-" + i} name={adminLinks[i]?.name || ""}>
            <a
                className="text-blue-400 dark:text-blue-600 hover:text-blue-600 dark:hover:text-blue-400"
                href={adminLinks[i]?.url}
            >
                {adminLinks[i]?.title || ""}
            </a>
        </Property>
    );
    return (
        <>
            <div className="flex">
                <div className="flex-1">
                    <div className="flex">
                        <h3>{workspace.workspaceId}</h3>
                        <span className="my-auto ml-3">
                            <WorkspaceStatusIndicator instance={WorkspaceAndInstance.toInstance(workspace)} />
                        </span>
                    </div>
                    <p>{getProject(WorkspaceAndInstance.toWorkspace(workspace))}</p>
                </div>
                <button
                    className="danger ml-3"
                    disabled={activity || workspace.phase === "stopped"}
                    onClick={stopWorkspace}
                >
                    Stop Workspace
                </button>
            </div>
            <div className="flex mt-6">
                <div className="flex flex-col w-full">
                    <div className="flex w-full mt-6">
                        <Property name="Created">
                            {dayjs(workspace.workspaceCreationTime).format("MMM D, YYYY")}
                        </Property>
                        <Property name="Last Start">{dayjs(workspace.instanceCreationTime).fromNow()}</Property>
                        <Property name="Context">
                            <a
                                className="text-blue-400 dark:text-blue-600 hover:text-blue-600 dark:hover:text-blue-400"
                                href={ContextURL.getNormalizedURL(workspace)?.toString()}
                            >
                                {workspace.context.title}
                            </a>
                        </Property>
                    </div>
                    <div className="flex w-full mt-6">
                        <Property name="User">
                            <Link
                                className="text-blue-400 dark:text-blue-600 hover:text-blue-600 dark:hover:text-blue-400"
                                to={"/admin/users/" + props.workspace.ownerId}
                            >
                                {user?.name || props.workspace.ownerId}
                            </Link>
                        </Property>
                        <Property name="Sharing">{workspace.shareable ? "Enabled" : "Disabled"}</Property>
                        <Property
                            name="Soft Deleted"
                            actions={
                                !!workspace.softDeleted && !workspace.contentDeletedTime
                                    ? [
                                          {
                                              label: "Restore & Pin",
                                              onClick: async () => {
                                                  await getGitpodService().server.adminRestoreSoftDeletedWorkspace(
                                                      workspace.workspaceId,
                                                  );
                                                  await reload();
                                              },
                                          },
                                      ]
                                    : undefined
                            }
                        >
                            {workspace.softDeleted
                                ? `'${workspace.softDeleted}' ${dayjs(workspace.softDeletedTime).fromNow()}`
                                : "No"}
                        </Property>
                    </div>
                    <div className="flex w-full mt-12">
                        <Property name="Latest Instance ID">
                            <div className="overflow-scroll">{workspace.instanceId}</div>
                        </Property>
                        <Property name="Region">{workspace.region}</Property>
                        <Property name="Stopped">
                            {workspace.stoppedTime ? dayjs(workspace.stoppedTime).fromNow() : "---"}
                        </Property>
                    </div>
                    <div className="flex w-full mt-12">
                        <Property name="Node">
                            <div className="overflow-scroll">{workspace.status.nodeName ?? "not assigned"}</div>
                        </Property>
                        <Property name="Class">
                            <div>{workspace.workspaceClass ?? "unknown"}</div>
                        </Property>
                    </div>
                    <div className="flex w-full mt-6">{[0, 1, 2].map(adminLink)}</div>
                    <div className="flex w-full mt-6">{[3, 4, 5].map(adminLink)}</div>
                </div>
            </div>
        </>
    );
}
