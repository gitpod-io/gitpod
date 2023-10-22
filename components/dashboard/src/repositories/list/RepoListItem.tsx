/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC } from "react";
import { usePrettyRepoURL } from "../../hooks/use-pretty-repo-url";
import { TextMuted } from "@podkit/typography/TextMuted";
import { Text } from "@podkit/typography/Text";
import { Link } from "react-router-dom";
import { Button } from "../../components/Button";
import { Project } from "@gitpod/public-api/lib/gitpod/experimental/v1/projects_pb";

type Props = {
    project: Project;
};
export const RepositoryListItem: FC<Props> = ({ project }) => {
    const url = usePrettyRepoURL(project.cloneUrl);

    return (
        <li key={project.id} className="flex flex-row w-full space-between items-center">
            <div className="flex flex-col flex-grow gap-1">
                <Text className="font-semibold">{project.name}</Text>
                <TextMuted className="text-sm">{url}</TextMuted>
            </div>

            <div>
                <Link to={`/repositories/${project.id}`}>
                    <Button type="secondary">View</Button>
                </Link>
            </div>
        </li>
    );
};
