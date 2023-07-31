/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Link } from "react-router-dom";
import { Project } from "@gitpod/gitpod-protocol";
import Prebuilds from "../projects/Prebuilds";
import Property from "./Property";
import dayjs from "dayjs";
import { Heading2, Subheading } from "../components/typography/headings";

export default function ProjectDetail(props: { project: Project; owner: string | undefined }) {
    return (
        <div className="app-container">
            <div className="flex mt-8">
                <div className="flex-1">
                    <div className="flex">
                        <Heading2>{props.project.name}</Heading2>
                        <span className="my-auto"></span>
                    </div>
                    <Subheading>{props.project.cloneUrl}</Subheading>
                </div>
            </div>
            <div className="flex flex-col w-full">
                <div className="flex w-full mt-6">
                    <Property name="Created">{dayjs(props.project.creationTime).format("MMM D, YYYY")}</Property>
                    <Property name="Repository">
                        <a
                            className="text-blue-400 dark:text-blue-600 hover:text-blue-600 dark:hover:text-blue-400 truncate"
                            href={props.project.cloneUrl}
                        >
                            {props.project.name}
                        </a>
                    </Property>
                    <Property name="Owner">
                        <Link
                            className="text-blue-400 dark:text-blue-600 hover:text-blue-600 dark:hover:text-blue-400 truncate"
                            to={"/admin/orgs/" + props.project.teamId}
                        >
                            {props.owner}
                        </Link>
                        <span className="text-gray-400 dark:text-gray-500"> (Organization)</span>
                    </Property>
                </div>
                <div className="flex w-full mt-6">
                    <Property name="Incremental Prebuilds">
                        {props.project.settings?.useIncrementalPrebuilds ? "Yes" : "No"}
                    </Property>
                    <Property name="Marked Deleted">{props.project.markedDeleted ? "Yes" : "No"}</Property>
                </div>
            </div>
            <div className="mt-6">
                <Prebuilds project={props.project} isAdminDashboard={true} />
            </div>
        </div>
    );
}
