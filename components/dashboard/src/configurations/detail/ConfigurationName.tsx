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
import { useUpdateProject } from "../../data/projects/project-queries";
import { useToast } from "../../components/toasts/Toasts";
import { useOnBlurError } from "../../hooks/use-onblur-error";

const MAX_LENGTH = 100;

type Props = {
    project: Project;
};

export const ConfigurationNameForm: FC<Props> = ({ project }) => {
    const { toast } = useToast();
    const updateProject = useUpdateProject();
    const [projectName, setProjectName] = useState(project.name);

    const nameError = useOnBlurError("Sorry, this name is too long.", projectName.length <= MAX_LENGTH);

    const updateName = useCallback(
        async (e: React.FormEvent) => {
            e.preventDefault();

            if (!nameError.isValid) {
                toast("Please correct the errors with the name.");
                return;
            }

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
        [nameError.isValid, updateProject, project.id, projectName, toast],
    );

    return (
        <form onSubmit={updateName}>
            <TextInputField
                hint={`The name can be up to ${MAX_LENGTH} characters long.`}
                value={projectName}
                error={nameError.message}
                onChange={setProjectName}
                onBlur={nameError.onBlur}
            />

            <Button
                className="mt-4"
                htmlType="submit"
                disabled={project.name === projectName}
                loading={updateProject.isLoading}
            >
                Update Name
            </Button>
        </form>
    );
};
