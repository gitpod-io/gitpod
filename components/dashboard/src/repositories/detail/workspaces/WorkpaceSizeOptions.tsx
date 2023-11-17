/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import type { Configuration } from "@gitpod/public-api/lib/gitpod/v1/configuration_pb";
import React, { useCallback, useState } from "react";
import { useWorkspaceClasses } from "../../../data/workspaces/workspace-classes-query";
import { Label } from "@podkit/forms/Label";
import { RadioGroup, RadioGroupItem } from "@podkit/forms/RadioListField";
import { TextMuted } from "@podkit/typography/TextMuted";
import { Heading2 } from "@podkit/typography/Headings";
import { ConfigurationSettingsField } from "../ConfigurationSettingsField";
import { useToast } from "../../../components/toasts/Toasts";
import { LoadingButton } from "@podkit/buttons/LoadingButton";
import { LoadingState } from "@podkit/loading/LoadingState";
import { useConfigurationMutation } from "../../../data/configurations/configuration-queries";

interface Props {
    configuration: Configuration;
}

export const ConfigurationWorkspaceSizeOptions = ({ configuration }: Props) => {
    const [selectedValue, setSelectedValue] = useState(
        configuration.workspaceSettings?.workspaceClass || "g1-standard",
    );
    const classChanged = selectedValue !== configuration.workspaceSettings?.workspaceClass;

    const updateConfiguration = useConfigurationMutation();
    const { data: classes, isError, isLoading } = useWorkspaceClasses();

    const { toast } = useToast();

    const setWorkspaceClass = useCallback(
        async (e: React.FormEvent) => {
            e.preventDefault();

            updateConfiguration.mutate(
                {
                    id: configuration.id,
                    workspaceSettings: {
                        workspaceClass: selectedValue,
                    },
                },
                {
                    onSuccess: () => {
                        // todo: use optimistic updates when we introduce configuration update hooks
                        toast({ message: "Workspace size updated" });
                    },
                    onError: (e) => {
                        toast({ message: `Failed updating workspace size: ${e.message}` });
                    },
                },
            );
        },
        [configuration.id, selectedValue, toast, updateConfiguration],
    );

    if (isError || !classes) {
        return <div>Something went wrong</div>;
    }

    if (isLoading) {
        return <LoadingState />;
    }

    return (
        <ConfigurationSettingsField className="px-8 py-6">
            <form onSubmit={setWorkspaceClass}>
                <div className="mb-4">
                    <Heading2 className="text-base">Workspace Size Options</Heading2>
                    <TextMuted>Choose the size of your workspace based on the resources you need.</TextMuted>
                </div>
                <RadioGroup value={selectedValue} onValueChange={setSelectedValue}>
                    {classes.map((wsClass) => (
                        <Label className="flex items-start space-x-2 my-2">
                            <RadioGroupItem value={wsClass.id} />
                            <div className="flex flex-col space-y-2">
                                <span className="font-bold">{wsClass.displayName}</span>
                                <span>{wsClass.description}</span>
                            </div>
                        </Label>
                    ))}
                </RadioGroup>
                <LoadingButton
                    className="mt-8"
                    type="submit"
                    disabled={!classChanged}
                    loading={updateConfiguration.isLoading}
                >
                    Save
                </LoadingButton>
            </form>
        </ConfigurationSettingsField>
    );
};
