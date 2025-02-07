/**
 * Copyright (c) 2025 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { OrganizationSettings } from "@gitpod/public-api/lib/gitpod/v1/organization_pb";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Heading2, Heading3, Subheading } from "../components/typography/headings";
import { useIsOwner } from "../data/organizations/members-query";
import { useOrgSettingsQuery } from "../data/organizations/org-settings-query";
import { useCurrentOrg } from "../data/organizations/orgs-query";
import { useUpdateOrgSettingsMutation } from "../data/organizations/update-org-settings-mutation";
import { OrgSettingsPage } from "./OrgSettingsPage";
import { ConfigurationSettingsField } from "../repositories/detail/ConfigurationSettingsField";
import { useDocumentTitle } from "../hooks/use-document-title";
import { useToast } from "../components/toasts/Toasts";
import type { PlainMessage } from "@bufbuild/protobuf";
import { InputField } from "../components/forms/InputField";
import { TextInput } from "../components/forms/TextInputField";
import { LoadingButton } from "@podkit/buttons/LoadingButton";
import { Link } from "react-router-dom";
import { useOrgSuggestedRepos } from "../data/organizations/suggested-repositories-query";
import { RepositoryListItem } from "../repositories/list/RepoListItem";
import { LoadingState } from "@podkit/loading/LoadingState";
import { Table, TableHeader, TableRow, TableHead, TableBody } from "@podkit/tables/Table";

export default function TeamOnboardingPage() {
    useDocumentTitle("Organization Settings - Onboarding");
    const { toast } = useToast();
    const org = useCurrentOrg().data;
    const isOwner = useIsOwner();

    const { data: settings } = useOrgSettingsQuery();
    const updateTeamSettings = useUpdateOrgSettingsMutation();

    const { data: suggestedRepos, isLoading: isLoadingSuggestedRepos } = useOrgSuggestedRepos();

    const [internalLink, setInternalLink] = useState<string | undefined>(undefined);

    const handleUpdateTeamSettings = useCallback(
        async (newSettings: Partial<PlainMessage<OrganizationSettings>>, options?: { throwMutateError?: boolean }) => {
            if (!org?.id) {
                throw new Error("no organization selected");
            }
            if (!isOwner) {
                throw new Error("no organization settings change permission");
            }
            try {
                await updateTeamSettings.mutateAsync({
                    ...settings,
                    ...newSettings,
                });
                toast("Organization settings updated");
            } catch (error) {
                if (options?.throwMutateError) {
                    throw error;
                }
                toast(`Failed to update organization settings: ${error.message}`);
                console.error(error);
            }
        },
        [updateTeamSettings, org?.id, isOwner, settings, toast],
    );

    const handleUpdateInternalLink = useCallback(
        async (e: FormEvent) => {
            e.preventDefault();

            await handleUpdateTeamSettings({
                onboardingSettings: {
                    internalLink,
                    recommendedRepositories: settings?.onboardingSettings?.recommendedRepositories ?? [],
                },
            });
        },
        [handleUpdateTeamSettings, internalLink, settings?.onboardingSettings?.recommendedRepositories],
    );

    useEffect(() => {
        if (settings) {
            setInternalLink(settings.onboardingSettings?.internalLink);
        }
    }, [settings]);

    return (
        <OrgSettingsPage>
            <div className="space-y-8">
                <div>
                    <Heading2>Onboarding</Heading2>
                    <Subheading>Customize the onboarding experience for your organization members.</Subheading>
                </div>
                <ConfigurationSettingsField>
                    <Heading3>Internal landing page</Heading3>
                    <Subheading>
                        The link to your internal landing page. This link will be shown to your organization members
                        during the onboarding process. You can disable showing a link by leaving this field empty.
                    </Subheading>
                    <form onSubmit={handleUpdateInternalLink}>
                        <InputField label="Internal landing page link" error={undefined} className="mb-4">
                            <TextInput
                                value={internalLink}
                                type="url"
                                placeholder="https://en.wikipedia.org/wiki/Heisenbug"
                                onChange={setInternalLink}
                                disabled={updateTeamSettings.isLoading || !isOwner}
                            />
                        </InputField>
                        <LoadingButton type="submit" loading={updateTeamSettings.isLoading} disabled={!isOwner}>
                            Save
                        </LoadingButton>
                    </form>
                </ConfigurationSettingsField>

                <ConfigurationSettingsField>
                    <Heading3>Suggested repositories</Heading3>
                    <Subheading>
                        A list of repositories suggested to new organization members. You can toggle a repository's
                        visibility in the onboarding process by visiting the{" "}
                        <Link to="/repositories" className="gp-link">
                            Repository settings
                        </Link>{" "}
                        page and toggling the "Mark this repository as Suggested" setting under the details of the
                        repository.
                    </Subheading>
                    {(suggestedRepos ?? []).length > 0 && (
                        <Table className="mt-4">
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-52">Name</TableHead>
                                    <TableHead hideOnSmallScreen>Repository</TableHead>
                                    <TableHead className="w-32" hideOnSmallScreen>
                                        Created
                                    </TableHead>
                                    <TableHead className="w-24" hideOnSmallScreen>
                                        Prebuilds
                                    </TableHead>
                                    {/* Action column, loading status in header */}
                                    <TableHead className="w-24 text-right">
                                        {isLoadingSuggestedRepos && (
                                            <div className="flex flex-right justify-end items-center">
                                                <LoadingState delay={false} size={16} />
                                            </div>
                                        )}
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {(suggestedRepos ?? []).map((repo) => (
                                    <RepositoryListItem
                                        key={repo.configurationId}
                                        configuration={repo.configuration}
                                        isSuggested={true}
                                    />
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </ConfigurationSettingsField>
            </div>
        </OrgSettingsPage>
    );
}
