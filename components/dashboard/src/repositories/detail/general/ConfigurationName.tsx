/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import type { Configuration } from "@gitpod/public-api/lib/gitpod/v1/configuration_pb";
import { Button } from "@podkit/buttons/Button";
import { LoadingButton } from "@podkit/buttons/LoadingButton";
import { FC, useCallback } from "react";
import { TextInputField } from "../../../components/forms/TextInputField";
import { useToast } from "../../../components/toasts/Toasts";
import { useUpdateProject } from "../../../data/projects/project-queries";
import { useOnBlurError } from "../../../hooks/use-onblur-error";
import { ConfigurationSettingsField } from "../ConfigurationSettingsField";
import { useDirtyState } from "../../../hooks/use-dirty-state";

const MAX_LENGTH = 100;

type Props = {
    configuration: Configuration;
};

export const ConfigurationNameForm: FC<Props> = ({ configuration }) => {
    const { toast } = useToast();
    const updateProject = useUpdateProject();
    const [projectName, setProjectName, isNameDirty] = useDirtyState(configuration.name);

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
                    id: configuration.id,
                    name: projectName,
                },
                {
                    onSuccess: () => {
                        toast(`Configuration name set to "${projectName}".`);
                        setProjectName(projectName);
                    },
                },
            );
        },
        [nameError.isValid, updateProject, configuration.id, projectName, toast, setProjectName],
    );

    return (
        <ConfigurationSettingsField>
            <form onSubmit={updateName}>
                <TextInputField
                    label="Configuration name"
                    hint={`The name can be up to ${MAX_LENGTH} characters long.`}
                    value={projectName}
                    error={nameError.message}
                    onChange={setProjectName}
                    onBlur={nameError.onBlur}
                />
                <div className="flex flex-row items-center justify-start gap-2 mt-4 w-full">
                    <LoadingButton type="submit" disabled={!isNameDirty} loading={updateProject.isLoading}>
                        Save
                    </LoadingButton>
                    <Button
                        variant="secondary"
                        disabled={!isNameDirty}
                        onClick={() => {
                            setProjectName(configuration.name);
                        }}
                    >
                        Cancel
                    </Button>
                </div>
            </form>
        </ConfigurationSettingsField>
    );
};
