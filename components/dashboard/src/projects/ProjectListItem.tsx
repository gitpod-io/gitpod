/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FunctionComponent, useContext, useMemo, useState } from "react";
import dayjs from "dayjs";
import { Project } from "@gitpod/gitpod-protocol";
import { Link } from "react-router-dom";
import ContextMenu from "../components/ContextMenu";
import { useCurrentTeam } from "../teams/teams-context";
import { RemoveProjectModal } from "./RemoveProjectModal";
import { toRemoteURL } from "./render-utils";
import { prebuildStatusIcon } from "./Prebuilds";
import { gitpodHostUrl } from "../service/service";
import Tooltip from "../components/Tooltip";
import { useLatestProjectPrebuildQuery } from "../data/prebuilds/latest-project-prebuild-query";
import { StartWorkspaceModalContext } from "../workspaces/start-workspace-modal-context";

type ProjectListItemProps = {
    project: Project;
    onProjectRemoved: () => void;
};

export const ProjectListItem: FunctionComponent<ProjectListItemProps> = ({ project, onProjectRemoved }) => {
    const team = useCurrentTeam();
    const [showRemoveModal, setShowRemoveModal] = useState(false);
    const { data: prebuild, isLoading } = useLatestProjectPrebuildQuery({ projectId: project.id });
    const { setStartWorkspaceModalProps } = useContext(StartWorkspaceModalContext);

    const teamOrUserSlug = useMemo(() => {
        return !!team ? "t/" + team.slug : "projects";
    }, [team]);

    return (
        <div key={`project-${project.id}`} className="h-52">
            <div className="h-42 border border-gray-100 dark:border-gray-800 rounded-t-xl">
                <div className="h-32 p-6">
                    <div className="flex text-gray-700 dark:text-gray-200 font-medium">
                        <ProjectLink project={project} teamOrUserSlug={teamOrUserSlug} />
                        <span className="flex-grow" />
                        <div className="justify-end">
                            <ContextMenu
                                menuEntries={[
                                    {
                                        title: "New Workspace",
                                        href: gitpodHostUrl.withContext(`${project.cloneUrl}`).toString(),
                                        separator: true,
                                    },
                                    {
                                        title: "New Workspace ...",
                                        onClick: () =>
                                            setStartWorkspaceModalProps({
                                                contextUrl: project.cloneUrl,
                                                allowContextUrlChange: true,
                                            }),
                                        separator: true,
                                    },
                                    {
                                        title: "Remove Project",
                                        customFontStyle:
                                            "text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300",
                                        onClick: () => setShowRemoveModal(true),
                                    },
                                ]}
                            />
                        </div>
                    </div>
                    <a href={project.cloneUrl.replace(/\.git$/, "")}>
                        <p className="hover:text-gray-600 dark:hover:text-gray-400 dark:text-gray-500 pr-10 truncate">
                            {toRemoteURL(project.cloneUrl)}
                        </p>
                    </a>
                </div>
                <div className="h-10 px-6 py-1 text-gray-400 text-sm">
                    <span className="hover:text-gray-600 dark:hover:text-gray-300">
                        <Link to={`/${teamOrUserSlug}/${project.slug || project.name}`}>Branches</Link>
                    </span>
                    <span className="mx-2 my-auto">·</span>
                    <span className="hover:text-gray-600 dark:hover:text-gray-300">
                        <Link to={`/${teamOrUserSlug}/${project.slug || project.name}/prebuilds`}>Prebuilds</Link>
                    </span>
                </div>
            </div>
            <div className="h-10 px-4 border rounded-b-xl dark:border-gray-800 bg-gray-100 border-gray-100 dark:bg-gray-800">
                {prebuild ? (
                    <div className="flex flex-row h-full text-sm space-x-4">
                        <Link
                            to={`/${teamOrUserSlug}/${project.slug || project.name}/${prebuild?.info?.id}`}
                            className="flex-grow flex items-center group space-x-2 truncate"
                        >
                            {prebuildStatusIcon(prebuild)}
                            <div
                                className="font-semibold text-gray-500 dark:text-gray-400 truncate"
                                title={prebuild?.info?.branch}
                            >
                                {prebuild?.info?.branch}
                            </div>
                            <span className="flex-shrink-0 mx-1 text-gray-400 dark:text-gray-600">·</span>
                            <Tooltip className="w-fit" content={dayjs(prebuild?.info?.startedAt).format("MMM D, YYYY")}>
                                <div className="flex-shrink-0 text-gray-400 dark:text-gray-500 group-hover:text-gray-800 dark:group-hover:text-gray-300">
                                    {dayjs(prebuild?.info?.startedAt).fromNow()}
                                </div>
                            </Tooltip>
                        </Link>
                        <Link
                            to={`/${teamOrUserSlug}/${project.slug || project.name}/prebuilds`}
                            className="flex-shrink-0 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                            View All &rarr;
                        </Link>
                    </div>
                ) : isLoading ? (
                    <div className="flex h-full text-md">
                        <p className="my-auto ">...</p>
                    </div>
                ) : (
                    <div className="flex h-full text-md">
                        <p className="my-auto ">No recent prebuilds</p>
                    </div>
                )}
            </div>
            {showRemoveModal && (
                <RemoveProjectModal
                    project={project}
                    onClose={() => setShowRemoveModal(false)}
                    onRemoved={onProjectRemoved}
                />
            )}
        </div>
    );
};

type ProjectLinkProps = {
    project: Project;
    teamOrUserSlug: string;
};
const ProjectLink: FunctionComponent<ProjectLinkProps> = ({ project, teamOrUserSlug }) => {
    let slug = "";
    const name = project.name;

    if (project.slug) {
        slug = project.slug;
    } else {
        // For existing GitLab projects that don't have a slug yet
        slug = name;
    }

    return (
        <Link to={`/${teamOrUserSlug}/${slug}`}>
            <span className="text-xl font-semibold">{name}</span>
        </Link>
    );
};
