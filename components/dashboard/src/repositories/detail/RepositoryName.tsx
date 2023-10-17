/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

// TODO: fix mismatched project types when we build repo configuration apis
import { Project } from "@gitpod/gitpod-protocol/lib/teams-projects-protocol";
import { Button } from "../../components/Button";
import { TextInputField } from "../../components/forms/TextInputField";
import { FC, useCallback, useState } from "react";
import { useUpdateProject } from "../../data/projects/project-query";
import { useToast } from "../../components/toasts/Toasts";
import { useOnBlurError } from "../../hooks/use-onblur-error";

type Props = {
    project: Project;
};

export const RepositoryNameForm: FC<Props> = ({ project }) => {
    const { toast } = useToast();
    const updateProject = useUpdateProject();
    const [projectName, setProjectName] = useState(project.name);

    const nameError = useOnBlurError("Sorry, this name is too long.", projectName.length > 32);

    const updateName = useCallback(
        async (e: React.FormEvent) => {
            e.preventDefault();

            updateProject.mutate(
                {
                    id: project.id,
                    name: projectName,
                },
                {
                    onSuccess: () => {
                        toast(`Configuration name set to "${projectName}".`);
                    },
                },
            );
        },
        [updateProject, project.id, projectName, toast],
    );

    return (
        <form onSubmit={updateName}>
            <TextInputField
                hint="The name can be up to 32 characters long."
                value={projectName}
                error={nameError.message}
                onChange={setProjectName}
                onBlur={nameError.onBlur}
            />

            {/* Don't disable button, just handle error and message */}
            <Button className="mt-4" htmlType="submit" disabled={project.name === projectName || !nameError.isValid}>
                Update Name
            </Button>
        </form>
    );
};
