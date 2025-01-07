/**
 * Copyright (c) 2025 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { OrganizationSettings } from "@gitpod/public-api/lib/gitpod/v1/organization_pb";
import { useCallback, useEffect, useState } from "react";
import Alert from "../components/Alert";
import { Heading2, Heading3, Subheading } from "../components/typography/headings";
import { useIsOwner } from "../data/organizations/members-query";
import { useOrgSettingsQuery } from "../data/organizations/org-settings-query";
import { useCurrentOrg } from "../data/organizations/orgs-query";
import { useUpdateOrgSettingsMutation } from "../data/organizations/update-org-settings-mutation";
import { OrgSettingsPage } from "./OrgSettingsPage";
import { ConfigurationSettingsField } from "../repositories/detail/ConfigurationSettingsField";
import { useDocumentTitle } from "../hooks/use-document-title";
import { useOrgBillingMode } from "../data/billing-mode/org-billing-mode-query";
import { useToast } from "../components/toasts/Toasts";
import type { PlainMessage } from "@bufbuild/protobuf";
import { Link } from "react-router-dom";
import { InputField } from "../components/forms/InputField";
import { TextInput } from "../components/forms/TextInputField";
import { LoadingButton } from "@podkit/buttons/LoadingButton";

export default function TeamOnboardingPage() {
    useDocumentTitle("Organization Settings - Onboarding");
    const { toast } = useToast();
    const org = useCurrentOrg().data;
    const isOwner = useIsOwner();

    const { data: settings } = useOrgSettingsQuery();
    const updateTeamSettings = useUpdateOrgSettingsMutation();

    const [internalLink, setInternalLink] = useState<string | undefined>(undefined);

    const billingMode = useOrgBillingMode();

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

    const handleUpdateInternalLink = useCallback(async () => {
        await handleUpdateTeamSettings({ onboardingSettings: { internalLink } });
    }, [handleUpdateTeamSettings, internalLink]);

    useEffect(() => {
        // if (settings) {
        //     setInternalLink(settings.internalLink);
        // }
    }, [settings?.timeoutSettings]);

    const isPaidOrDedicated =
        billingMode.data?.mode === "none" || (billingMode.data?.mode === "usage-based" && billingMode.data?.paid);

    return (
        <>
            <OrgSettingsPage>
                <div className="space-y-8">
                    <div>
                        <Heading2>Policies</Heading2>
                        <Subheading>
                            Restrict workspace classes, editors and sharing across your organization.
                        </Subheading>
                    </div>
                    <ConfigurationSettingsField>
                        <Heading3>Internal dashboard</Heading3>
                        {!isPaidOrDedicated && (
                            <Alert type="info" className="my-3">
                                Setting Workspace timeouts is only available for organizations on a paid plan. Visit{" "}
                                <Link to={"/billing"} className="gp-link">
                                    Billing
                                </Link>{" "}
                                to upgrade your plan.
                            </Alert>
                        )}
                        <form onSubmit={handleUpdateInternalLink}>
                            <InputField
                                label="Default workspace timeout"
                                error={undefined}
                                hint={
                                    <span>
                                        Use minutes or hours, like <span className="font-semibold">30m</span> or{" "}
                                        <span className="font-semibold">2h</span>
                                    </span>
                                }
                            >
                                <TextInput
                                    value={internalLink}
                                    type="url"
                                    onChange={setInternalLink}
                                    disabled={updateTeamSettings.isLoading || !isOwner || !isPaidOrDedicated}
                                />
                            </InputField>
                            <LoadingButton
                                type="submit"
                                loading={updateTeamSettings.isLoading}
                                disabled={!isOwner || !isPaidOrDedicated}
                            >
                                Save
                            </LoadingButton>
                        </form>
                    </ConfigurationSettingsField>
                </div>
            </OrgSettingsPage>
        </>
    );
}
