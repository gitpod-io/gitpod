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
import { SwitchInputField } from "@podkit/switch/Switch";
import { WelcomeMessagePreview } from "./onboarding/WelcomeMessagePreview";
import { WelcomeMessageEditorModal } from "./onboarding/WelcomeMessageEditor";

export const gitpodWelcomeSubheading =
    `Gitpod’s sandboxed, ephemeral development environments enable you to use your existing tools without worrying about vulnerabilities impacting their local machines.` as const;

export default function TeamOnboardingPage() {
    useDocumentTitle("Organization Settings - Onboarding");
    const { toast } = useToast();
    const org = useCurrentOrg().data;
    const isOwner = useIsOwner();

    const { data: settings } = useOrgSettingsQuery();
    const updateTeamSettings = useUpdateOrgSettingsMutation();

    const [internalLink, setInternalLink] = useState<string | undefined>(undefined);
    const [welcomeMessageEditorOpen, setWelcomeMessageEditorOpen] = useState<boolean>(false);

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

            await handleUpdateTeamSettings({ onboardingSettings: { internalLink } });
        },
        [handleUpdateTeamSettings, internalLink],
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
                    <Heading2>Policies</Heading2>
                    <Subheading>Restrict workspace classes, editors and sharing across your organization.</Subheading>
                </div>
                <ConfigurationSettingsField>
                    <Heading3>Internal dashboard</Heading3>
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
                    <Heading3>Welcome message</Heading3>
                    <Subheading>
                        A welcome message to your organization members. This message will be shown to your organization
                        members once they sign up and join your organization.
                    </Subheading>

                    <InputField
                        label="Enabled"
                        hint={<>Enable showing the message to new organization members.</>}
                        id="show-welcome-message"
                    >
                        <SwitchInputField
                            id="show-welcome-message"
                            checked={settings?.onboardingSettings?.welcomeMessage?.enabled ?? false}
                            disabled={!isOwner || updateTeamSettings.isLoading}
                            onCheckedChange={(checked) => {
                                if (checked) {
                                    if (!settings?.onboardingSettings?.welcomeMessage?.message) {
                                        toast("Please set up a welcome message first.");
                                        return;
                                    }
                                }

                                updateTeamSettings.mutate({
                                    onboardingSettings: {
                                        welcomeMessage: {
                                            enabled: checked,
                                            message: settings?.onboardingSettings?.welcomeMessage?.message,
                                            featuredMemberId:
                                                settings?.onboardingSettings?.welcomeMessage?.featuredMemberId,
                                        },
                                    },
                                });
                            }}
                            label=""
                        />
                    </InputField>

                    <WelcomeMessageEditorModal
                        isLoading={updateTeamSettings.isLoading}
                        isOwner={isOwner}
                        isOpen={welcomeMessageEditorOpen}
                        setIsOpen={setWelcomeMessageEditorOpen}
                        handleUpdateTeamSettings={handleUpdateTeamSettings}
                        settings={settings?.onboardingSettings?.welcomeMessage}
                    />

                    <span className="text-pk-content-secondary text-sm">
                        Here's a preview of the welcome message that will be shown to your organization members:
                    </span>
                    <WelcomeMessagePreview
                        setWelcomeMessageEditorOpen={setWelcomeMessageEditorOpen}
                        disabled={!isOwner || updateTeamSettings.isLoading}
                    />
                </ConfigurationSettingsField>
            </div>
        </OrgSettingsPage>
    );
}
