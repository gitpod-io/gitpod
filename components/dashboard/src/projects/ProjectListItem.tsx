/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FunctionComponent, useState } from "react";
import dayjs from "dayjs";
import { Project } from "@gitpod/gitpod-protocol";
import { Link } from "react-router-dom";
import { RemoveProjectModal } from "./RemoveProjectModal";
import { toRemoteURL } from "./render-utils";
import { prebuildStatusIcon } from "./Prebuilds";
import { gitpodHostUrl } from "../service/service";
import { useLatestProjectPrebuildQuery } from "../data/prebuilds/latest-project-prebuild-query";
import Tooltip from "../components/Tooltip";
import { DropdownActions } from "@podkit/dropdown/DropDownActions";
import { DropdownMenuItem } from "@podkit/dropdown/DropDown";

type ProjectListItemProps = {
    project: Project;
    onProjectRemoved: () => void;
};

export const ProjectListItem: FunctionComponent<ProjectListItemProps> = ({ project, onProjectRemoved }) => {
    const [showRemoveModal, setShowRemoveModal] = useState(false);
    const { data: prebuild, isLoading } = useLatestProjectPrebuildQuery({ projectId: project.id });

    const enablePrebuilds = Project.getPrebuildSettings(project).enable;

    return (
        <div key={`project-${project.id}`} className="h-52">
            <div className="h-42 border border-gray-100 dark:border-gray-800 rounded-t-xl">
                <div className="h-32 p-6">
                    <div className="flex text-gray-700 dark:text-gray-200 font-medium">
                        <ProjectLink project={project} />
                        <span className="flex-grow" />
                        <div className="justify-end">
                            <DropdownActions>
                                <DropdownMenuItem asChild>
                                    <a href={gitpodHostUrl.withContext(`${project.cloneUrl}`).toString()}>
                                        New workspace
                                    </a>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                    <Link to={`/projects/${project.id}/settings`}>Settings</Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    className="text-red-600 dark:text-red-400 focus:text-red-800 dark:focus:text-red-300"
                                    onSelect={() => {
                                        setShowRemoveModal(true);
                                    }}
                                >
                                    Delete
                                </DropdownMenuItem>
                            </DropdownActions>
                        </div>
                    </div>
                    <a target="_blank" rel="noreferrer noopener" href={project.cloneUrl.replace(/\.git$/, "")}>
                        <p className="hover:text-gray-600 dark:hover:text-gray-400 dark:text-gray-500 pr-10 truncate">
                            {toRemoteURL(project.cloneUrl)}
                        </p>
                    </a>
                </div>
                <div className="h-10 px-6 py-1 text-gray-400 text-sm">
                    <span className="hover:text-gray-600 dark:hover:text-gray-300">
                        <Link to={`/projects/${project.id}`}>Branches</Link>
                    </span>
                    <span className="mx-2 my-auto">·</span>
                    <span className="hover:text-gray-600 dark:hover:text-gray-300">
                        <Link to={`/projects/${project.id}/prebuilds`}>Prebuilds</Link>
                    </span>
                </div>
            </div>
            <div className="h-10 px-4 border rounded-b-xl dark:border-gray-800 bg-gray-100 border-gray-100 dark:bg-gray-800">
                {!enablePrebuilds ? (
                    <div className="flex h-full text-sm">
                        <Link
                            to={`/projects/${project.id}/settings`}
                            className="flex-shrink-0 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                            Enable Prebuilds &rarr;
                        </Link>
                    </div>
                ) : prebuild ? (
                    <div className="flex flex-row h-full text-sm space-x-4">
                        <Link
                            to={`/projects/${project.id}/${prebuild?.id}`}
                            className="flex-grow flex items-center group space-x-2 truncate"
                        >
                            {prebuildStatusIcon(prebuild)}
                            <div
                                className="font-semibold text-gray-500 dark:text-gray-400 truncate"
                                title={prebuild?.ref}
                            >
                                {prebuild.ref}
                            </div>
                            <span className="flex-shrink-0 mx-1 text-gray-400 dark:text-gray-600">·</span>
                            <Tooltip content={dayjs(prebuild?.status?.startTime?.toDate()).format("MMM D, YYYY")}>
                                <div className="flex-shrink-0 text-gray-400 dark:text-gray-500 group-hover:text-gray-800 dark:group-hover:text-gray-300">
                                    {dayjs(prebuild?.status?.startTime?.toDate()).fromNow()}
                                </div>
                            </Tooltip>
                        </Link>
                        <Link
                            to={`/projects/${project.id}/prebuilds`}
                            className="flex-shrink-0 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                            View All &rarr;
                        </Link>
                    </div>
                ) : isLoading ? (
                    <div className="flex h-full text-sm">
                        <p className="my-auto ">...</p>
                    </div>
                ) : (
                    <div className="flex h-full text-sm">
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
};
const ProjectLink: FunctionComponent<ProjectLinkProps> = ({ project }) => {
    return (
        <Link to={`/projects/${project.id}`} className="truncate" title={project.name}>
            <span className="text-xl font-semibold">{project.name}</span>
        </Link>
    );
};
