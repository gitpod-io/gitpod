/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { OrganizationSettings } from "@gitpod/public-api/lib/gitpod/v1/organization_pb";
import { FormEvent, useEffect, useState } from "react";
import { ConfigurationSettingsField } from "../../repositories/detail/ConfigurationSettingsField";
import { Heading3, Subheading } from "@podkit/typography/Headings";
import { InputField } from "../../components/forms/InputField";
import { TextInput } from "../../components/forms/TextInputField";
import { LoadingButton } from "@podkit/buttons/LoadingButton";
import { MAX_PARALLEL_WORKSPACES_FREE, MAX_PARALLEL_WORKSPACES_PAID } from "@gitpod/gitpod-protocol";
import { PlainMessage } from "@bufbuild/protobuf";

type Props = {
    isOwner: boolean;
    isLoading: boolean;
    isPaidPlan: boolean;
    settings?: OrganizationSettings;
    handleUpdateTeamSettings: (
        newSettings: Partial<PlainMessage<OrganizationSettings>>,
        options?: {
            throwMutateError?: boolean;
        },
    ) => Promise<void>;
};

export const MaxParallelWorkspaces = ({
    isOwner,
    isLoading,
    settings,
    isPaidPlan,
    handleUpdateTeamSettings,
}: Props) => {
    const [error, setError] = useState<string | undefined>(undefined);
    const [maxParallelWorkspaces, setMaxParallelWorkspaces] = useState<number>(
        settings?.maxParallelRunningWorkspaces ?? 0,
    );

    const organizationDefault = isPaidPlan ? MAX_PARALLEL_WORKSPACES_PAID : MAX_PARALLEL_WORKSPACES_FREE;

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (maxParallelWorkspaces < 0) {
            setError("The maximum parallel running workspaces must be a positive number.");
            return;
        }
        await handleUpdateTeamSettings({
            maxParallelRunningWorkspaces: maxParallelWorkspaces,
        });
    };

    useEffect(() => {
        setMaxParallelWorkspaces(settings?.maxParallelRunningWorkspaces ?? 0);
    }, [settings?.maxParallelRunningWorkspaces]);

    return (
        <ConfigurationSettingsField>
            <Heading3>Maximum parallel running workspaces</Heading3>
            <Subheading>
                By default, every user in your organization can have <strong>{organizationDefault}</strong> workspaces
                running at the same time. You can change this limit below or revert to this default by specifying{" "}
                <strong>0</strong> as the limit.
            </Subheading>
            <form onSubmit={handleSubmit}>
                <InputField label="Maximum parallel running workspaces" error={error} className="mb-4">
                    <TextInput
                        value={maxParallelWorkspaces ?? ""}
                        onChange={(newValue) => {
                            setMaxParallelWorkspaces(parseInt(newValue));
                            setError(undefined);
                        }}
                        disabled={isLoading || !isOwner}
                    />
                </InputField>
                <LoadingButton type="submit" loading={isLoading} disabled={!isOwner}>
                    Save
                </LoadingButton>
            </form>
        </ConfigurationSettingsField>
    );
};
