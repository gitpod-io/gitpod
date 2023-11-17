/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import type { Configuration } from "@gitpod/public-api/lib/gitpod/v1/configuration_pb";
import { LoadingButton } from "@podkit/buttons/LoadingButton";
import { FC, useCallback, useState } from "react";
import { TextInputField } from "../../../components/forms/TextInputField";
import { useToast } from "../../../components/toasts/Toasts";
import { useOnBlurError } from "../../../hooks/use-onblur-error";
import { ConfigurationSettingsField } from "../ConfigurationSettingsField";
import { useConfigurationMutation } from "../../../data/configurations/configuration-queries";

const MAX_LENGTH = 100;

type Props = {
    configuration: Configuration;
};

export const ConfigurationNameForm: FC<Props> = ({ configuration }) => {
    const { toast } = useToast();
    const updateConfiguration = useConfigurationMutation();
    const [configurationName, setConfigurationName] = useState(configuration.name);

    const nameChanged = configurationName !== configuration.name;
    const nameError = useOnBlurError("Sorry, this name is too long.", configurationName.length <= MAX_LENGTH);

    const updateName = useCallback(
        async (e: React.FormEvent) => {
            e.preventDefault();

            if (!nameError.isValid) {
                toast("Please correct the errors with the name.");
                return;
            }

            updateConfiguration.mutate(
                {
                    id: configuration.id,
                    name: configurationName,
                },
                {
                    onSuccess: () => {
                        toast(`Configuration name set to "${configurationName}".`);
                    },
                },
            );
        },
        [nameError.isValid, updateConfiguration, configuration.id, configurationName, toast],
    );

    return (
        <ConfigurationSettingsField>
            <form onSubmit={updateName}>
                <TextInputField
                    label="Configuration name"
                    hint={`The name can be up to ${MAX_LENGTH} characters long.`}
                    value={configurationName}
                    error={nameError.message}
                    onChange={setConfigurationName}
                    onBlur={nameError.onBlur}
                />
                <div className="flex flex-row items-center justify-start gap-2 mt-4 w-full">
                    <LoadingButton type="submit" disabled={!nameChanged} loading={updateConfiguration.isLoading}>
                        Save
                    </LoadingButton>
                </div>
            </form>
        </ConfigurationSettingsField>
    );
};
