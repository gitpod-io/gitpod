/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Link } from "react-router-dom";
import { Project } from "@gitpod/gitpod-protocol";
import Property from "./Property";
import dayjs from "dayjs";
import { PrebuildsList } from "../prebuilds/list/PrebuildList";
import { Heading2, Heading3, Subheading } from "@podkit/typography/Headings";

type Props = {
    project: Project;
    owner?: string;
};
export default function ProjectDetail({ project, owner }: Props) {
    return (
        <div className="app-container">
            <div className="flex mt-8">
                <div className="flex-1">
                    <div className="flex">
                        <Heading2>{project.name}</Heading2>
                        <span className="my-auto"></span>
                    </div>
                    <Subheading>{project.cloneUrl}</Subheading>
                </div>
            </div>
            <div className="flex flex-col w-full">
                <div className="flex w-full mt-6">
                    <Property name="Created">{dayjs(project.creationTime).format("MMM D, YYYY")}</Property>
                    <Property name="Repository">
                        <a
                            className="text-blue-400 dark:text-blue-600 hover:text-blue-600 dark:hover:text-blue-400 truncate"
                            href={project.cloneUrl}
                        >
                            {project.name}
                        </a>
                    </Property>
                    <Property name="Owner">
                        <Link
                            className="text-blue-400 dark:text-blue-600 hover:text-blue-600 dark:hover:text-blue-400 truncate"
                            to={"/admin/orgs/" + project.teamId}
                        >
                            {owner}
                        </Link>
                        <span className="text-gray-400 dark:text-gray-500"> (Organization)</span>
                    </Property>
                </div>
                <div className="flex w-full mt-6">
                    <Property name="Marked Deleted">{project.markedDeleted ? "Yes" : "No"}</Property>
                </div>
            </div>
            <div className="mt-6">
                <Heading3 className="mb-4">Prebuilds</Heading3>
                <PrebuildsList
                    initialFilter={{ configurationId: project.id }}
                    organizationId={project.teamId}
                    hideOrgSpecificControls
                />
            </div>
        </div>
    );
}
