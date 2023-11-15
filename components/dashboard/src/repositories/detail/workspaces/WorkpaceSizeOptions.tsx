/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import type { Configuration } from "@gitpod/public-api/lib/gitpod/v1/configuration_pb";
import { useCallback, useState } from "react";
import { useWorkspaceClasses } from "../../../data/workspaces/workspace-classes-query";
import { Label } from "@podkit/forms/Label";
import { RadioGroup, RadioGroupItem } from "@podkit/forms/RadioListField";
import { TextMuted } from "@podkit/typography/TextMuted";
import { Heading2 } from "@podkit/typography/Headings";
import { ConfigurationSettingsField } from "../ConfigurationSettingsField";
import { useUpdateProject } from "../../../data/projects/project-queries";
import { useToast } from "../../../components/toasts/Toasts";

interface Props {
    configuration: Configuration;
}

export const ConfigurationWorkspaceSizeOptions = ({ configuration }: Props) => {
    const [selectedValue, setSelectedValue] = useState(
        configuration.workspaceSettings?.workspaceClass || "g1-standard",
    );

    const updateProject = useUpdateProject();
    const { data: classes, isError, isLoading } = useWorkspaceClasses();

    const { toast } = useToast();

    const setWorkspaceClass = useCallback(
        async (value: string) => {
            updateProject.mutate(
                {
                    id: configuration.id,
                    settings: {
                        workspaceClasses: {
                            regular: value,
                        },
                    },
                },
                {
                    onSuccess: () => {
                        // todo: use optimistic updates when we introduce configuration update hooks
                        setSelectedValue(value);
                        toast({ message: "Workspace size updated" });
                    },
                    onError: (e) => {
                        toast({ message: `Failed updating workspace size: ${e.message}` });
                    },
                },
            );
        },
        [configuration.id, toast, updateProject],
    );

    if (isError) {
        return <div>Something went wrong</div>;
    }

    if (isLoading || !classes) {
        return <div>Loading...</div>;
    }

    return (
        <ConfigurationSettingsField>
            <div className="mb-4">
                <Heading2 asChild>
                    <h2 className="text-base">Workspace Size Options</h2>
                </Heading2>
                <TextMuted>Choose the size of your workspace based on the resources you need.</TextMuted>
            </div>
            <RadioGroup value={selectedValue} onValueChange={setWorkspaceClass}>
                {classes.map((wsClass) => (
                    <div className="flex items-start space-x-2 my-2">
                        <RadioGroupItem value={wsClass.id} id={wsClass.id} />
                        <div className="flex flex-col">
                            <Label htmlFor={wsClass.id} className="font-bold">
                                {wsClass.displayName}
                            </Label>
                            <span>{wsClass.description}</span>
                        </div>
                    </div>
                ))}
            </RadioGroup>
        </ConfigurationSettingsField>
    );
};
