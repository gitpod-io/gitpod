/**
 * Copyright (c) 2025 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { SwitchInputField } from "@podkit/switch/Switch";
import { Heading3, Subheading } from "@podkit/typography/Headings";
import { FC, useCallback } from "react";
import { InputField } from "../../../components/forms/InputField";
import PillLabel from "../../../components/PillLabel";
import { useToast } from "../../../components/toasts/Toasts";
import { useOrgSettingsQuery } from "../../../data/organizations/org-settings-query";
import { useUpdateOrgSettingsMutation } from "../../../data/organizations/update-org-settings-mutation";
import { useId } from "../../../hooks/useId";
import { ConfigurationSettingsField } from "../ConfigurationSettingsField";
import { Configuration } from "@gitpod/public-api/lib/gitpod/v1/configuration_pb";
import { SquareArrowOutUpRight } from "lucide-react";

type Props = {
    configuration: Configuration;
};
export const ManageRepoSuggestion: FC<Props> = ({ configuration }) => {
    const { data: orgSettings } = useOrgSettingsQuery();
    const { toast } = useToast();
    const updateTeamSettings = useUpdateOrgSettingsMutation();
    const updateRecommendedRepository = useCallback(
        async (configurationId: string, suggested: boolean) => {
            const newRepositories = new Set(orgSettings?.onboardingSettings?.recommendedRepositories ?? []);
            if (suggested) {
                newRepositories.add(configurationId);
            } else {
                newRepositories.delete(configurationId);
            }

            await updateTeamSettings.mutateAsync(
                {
                    onboardingSettings: {
                        ...orgSettings?.onboardingSettings,
                        recommendedRepositories: [...newRepositories],
                    },
                },
                {
                    onError: (error) => {
                        toast(`Failed to update recommended repositories: ${error.message}`);
                    },
                },
            );
        },
        [orgSettings?.onboardingSettings, toast, updateTeamSettings],
    );

    const isSuggested = orgSettings?.onboardingSettings?.recommendedRepositories?.includes(configuration.id);

    const inputId = useId({ prefix: "suggested-repository" });

    return (
        <ConfigurationSettingsField>
            <Heading3 className="flex flex-row items-center gap-2">
                Mark this repository as{" "}
                <PillLabel className="capitalize bg-kumquat-light shrink-0 text-sm hidden xl:block" type="warn">
                    Suggested
                </PillLabel>
            </Heading3>
            <Subheading className="max-w-lg flex flex-col gap-2">
                The Suggested section highlights recommended repositories on the dashboard for new members, making it
                easier to find and start working on key projects in Gitpod.
                <a
                    className="gp-link flex flex-row items-center gap-1"
                    href="https://www.gitpod.io/docs/configure/orgs/onboarding#suggested-repositories"
                    target="_blank"
                    rel="noreferrer"
                >
                    Learn about suggestions
                    <SquareArrowOutUpRight size={12} />
                </a>
            </Subheading>
            <InputField id={inputId}>
                <SwitchInputField
                    id={inputId}
                    checked={isSuggested}
                    disabled={updateTeamSettings.isLoading}
                    onCheckedChange={(checked) => {
                        updateRecommendedRepository(configuration.id, checked);
                    }}
                    label={isSuggested ? "Listed in “Suggested”" : "Not listed in “Suggested”"}
                />
            </InputField>
        </ConfigurationSettingsField>
    );
};
