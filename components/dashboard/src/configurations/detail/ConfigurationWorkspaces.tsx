/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the repository root for license information.
 */

import { Project, ProjectSettings } from "@gitpod/gitpod-protocol";
import { Heading2, Subheading } from "@podkit/typography/headings";
import { useCallback } from "react";
import SelectWorkspaceClassComponent from "../../components/SelectWorkspaceClassComponent";
import { useToast } from "../../components/toasts/Toasts";
import { useUpdateProject } from "../../data/projects/project-queries";

interface RepositoryPrebuildsSettingsProps {
    repository: Project;
}

export default function ConfigurationWorkspacesSettings({ repository }: RepositoryPrebuildsSettingsProps) {
    const updateRepository = useUpdateProject();
    const { toast } = useToast();

    const updateRepositorySettings = useCallback(
        async (settings: ProjectSettings) => {
            if (!repository) return;

            const newSettings = { ...repository.settings, ...settings };
            await updateRepository.mutateAsync(
                { id: repository.id, settings: newSettings },
                {
                    onSuccess: () => {
                        toast(`Project ${repository.name} updated.`);
                    },
                    onError: (error) => {
                        toast(error?.message || "Oh no, there was a problem with updating repository settings.");
                    },
                },
            );
        },
        [repository, toast, updateRepository],
    );

    const setWorkspaceClass = useCallback(
        async (value: string) => {
            if (!repository) {
                return value;
            }
            const before = repository.settings?.workspaceClasses?.regular;
            updateRepositorySettings({
                workspaceClasses: { ...repository.settings?.workspaceClasses, regular: value },
            });
            return before;
        },
        [repository, updateRepositorySettings],
    );

    return (
        <section>
            <Heading2 className="mt-12">Workspaces</Heading2>
            <Subheading>Choose the workspace machine type for your workspaces.</Subheading>
            <div className="max-w-md mt-2">
                <SelectWorkspaceClassComponent
                    selectedWorkspaceClass={repository.settings?.workspaceClasses?.regular}
                    onSelectionChange={setWorkspaceClass}
                />
            </div>
        </section>
    );
}
