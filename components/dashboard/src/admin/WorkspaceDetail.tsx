/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { User, WorkspaceAndInstance, ContextURL, WorkspaceInstance } from "@gitpod/gitpod-protocol";
import { GitpodHostUrl } from "@gitpod/gitpod-protocol/lib/util/gitpod-host-url";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Heading2, Subheading } from "../components/typography/headings";
import { getGitpodService } from "../service/service";
import { getProjectPath } from "../workspaces/WorkspaceEntry";
import { WorkspaceStatusIndicator } from "../workspaces/WorkspaceStatusIndicator";
import Property from "./Property";
import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";
import { converter } from "../service/public-api";
import { Button } from "@podkit/buttons/Button";

export default function WorkspaceDetail(props: { workspace: WorkspaceAndInstance }) {
    const [workspace, setWorkspace] = useState(props.workspace);
    const [workspaceInstances, setWorkspaceInstances] = useState<WorkspaceInstance[]>([]);
    const [activity, setActivity] = useState(false);
    const [user, setUser] = useState<User>();
    useEffect(() => {
        getGitpodService().server.adminGetUser(props.workspace.ownerId).then(setUser);
        getGitpodService().server.adminGetWorkspaceInstances(props.workspace.workspaceId).then(setWorkspaceInstances);
    }, [props.workspace, workspace.workspaceId]);

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
            const [ws, workspaceInstances] = await Promise.all([
                await getGitpodService().server.adminGetWorkspace(workspace.workspaceId),
                await getGitpodService().server.adminGetWorkspaceInstances(workspace.workspaceId),
            ]);
            setWorkspace(ws);
            setWorkspaceInstances(workspaceInstances);
        } finally {
            setActivity(false);
        }
    };

    return (
        <div className="app-container">
            <div className="flex mt-8">
                <div className="flex-1">
                    <div className="flex">
                        <Heading2>{workspace.workspaceId}</Heading2>
                        <span className="my-auto ml-3">
                            <WorkspaceStatusIndicator
                                status={
                                    converter.toWorkspace({
                                        workspace: WorkspaceAndInstance.toWorkspace(workspace),
                                        latestInstance: WorkspaceAndInstance.toInstance(workspace),
                                    }).status
                                }
                            />
                        </span>
                    </div>
                    <Subheading>
                        {getProjectPath(
                            converter.toWorkspace({
                                workspace: WorkspaceAndInstance.toWorkspace(workspace),
                                latestInstance: WorkspaceAndInstance.toInstance(workspace),
                            }),
                        )}
                    </Subheading>
                </div>
                <Button
                    variant="secondary"
                    className="ml-3"
                    onClick={() => {
                        window.location.href = new GitpodHostUrl(window.location.href)
                            .with({
                                pathname: `/workspace-download/get/${workspace.workspaceId}`,
                            })
                            .toString();
                    }}
                >
                    Download Workspace
                </Button>
                <Button
                    variant="destructive"
                    className="ml-3"
                    disabled={activity || workspace.phase === "stopped"}
                    onClick={stopWorkspace}
                >
                    Stop Workspace
                </Button>
            </div>
            <div className="flex mt-6">
                <div className="flex flex-col w-full">
                    <div className="flex w-full mt-6">
                        <Property name="Created">
                            {dayjs(workspace.workspaceCreationTime).format("MMM D, YYYY")}
                        </Property>
                        <Property name="User">
                            <Link
                                className="text-blue-400 dark:text-blue-600 hover:text-blue-600 dark:hover:text-blue-400"
                                to={`/admin/users/${props.workspace.ownerId}`}
                            >
                                {user?.name || props.workspace.ownerId}
                            </Link>
                        </Property>
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
                        <Property name="Pinned">{workspace.pinned ? "Yes" : "No"}</Property>
                    </div>
                    <div className="flex w-full mt-12">
                        <Property name="Organization">
                            <Link
                                className="text-blue-400 dark:text-blue-600 hover:text-blue-600 dark:hover:text-blue-400"
                                to={`/admin/orgs/${workspace.organizationId}`}
                            >
                                {workspace.organizationId}
                            </Link>
                        </Property>
                        <Property name="Node">
                            <div className="overflow-scroll">{workspace.status.nodeName ?? "not assigned"}</div>
                        </Property>
                        <Property name="Class">
                            <div>{workspace.workspaceClass ?? "unknown"}</div>
                        </Property>
                    </div>
                </div>
            </div>
            <div className="flex mt-20">
                <div className="flex-1">
                    <div className="flex">
                        <Heading2>Workspace Instances</Heading2>
                    </div>
                </div>
            </div>
            <div className="flex flex-col space-y-2">
                <div className="px-6 py-3 flex justify-between text-sm text-gray-400 border-b border-gray-200 dark:border-gray-800 mb-2">
                    <span className="my-auto ml-3" />
                    <div className="w-4/12">InstanceId</div>
                    <div className="w-2/12">Started</div>
                    <div className="w-2/12">Duration</div>
                    <div className="w-2/12">Attributed</div>
                </div>
                {workspaceInstances
                    .sort((a, b) => a.creationTime.localeCompare(b.creationTime) * -1)
                    .map((wsi) => {
                        const attributionId = wsi.usageAttributionId && AttributionId.parse(wsi.usageAttributionId);
                        return (
                            <div className="px-6 py-3 flex justify-between text-sm text-gray-400 mb-2">
                                <span className="my-1 ml-3">
                                    <WorkspaceStatusIndicator status={converter.toWorkspace(wsi).status} />
                                </span>
                                <div className="w-4/12">{wsi.id}</div>
                                <div className="w-2/12">{dayjs(wsi.startedTime).fromNow()}</div>
                                <div className="w-2/12">
                                    {dayjs.duration(dayjs(wsi.stoppingTime).diff(wsi.startedTime)).humanize()}
                                </div>
                                <div className="w-2/12">
                                    {attributionId && attributionId?.kind === "team" ? (
                                        <Link
                                            className="text-blue-400 dark:text-blue-600 hover:text-blue-600 dark:hover:text-blue-400"
                                            to={`/admin/orgs/${attributionId.teamId}`}
                                        >
                                            {attributionId.teamId}
                                        </Link>
                                    ) : (
                                        "personal"
                                    )}
                                </div>
                            </div>
                        );
                    })}
                <div className="py-20" />
            </div>
        </div>
    );
}
