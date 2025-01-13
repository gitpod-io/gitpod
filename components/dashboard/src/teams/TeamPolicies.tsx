/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { isGitpodIo } from "../utils";
import { OrganizationSettings } from "@gitpod/public-api/lib/gitpod/v1/organization_pb";
import { FormEvent, useCallback, useEffect, useState } from "react";
import Alert from "../components/Alert";
import { CheckboxInputField } from "../components/forms/CheckboxInputField";
import { Heading2, Heading3, Subheading } from "../components/typography/headings";
import { useIsOwner } from "../data/organizations/members-query";
import { useOrgSettingsQuery } from "../data/organizations/org-settings-query";
import { useCurrentOrg } from "../data/organizations/orgs-query";
import { useUpdateOrgSettingsMutation } from "../data/organizations/update-org-settings-mutation";
import { OrgSettingsPage } from "./OrgSettingsPage";
import { ConfigurationSettingsField } from "../repositories/detail/ConfigurationSettingsField";
import { useDocumentTitle } from "../hooks/use-document-title";
import { useOrgBillingMode } from "../data/billing-mode/org-billing-mode-query";
import { converter } from "../service/public-api";
import { useToast } from "../components/toasts/Toasts";
import type { PlainMessage } from "@bufbuild/protobuf";
import { WorkspaceTimeoutDuration } from "@gitpod/gitpod-protocol";
import { Link } from "react-router-dom";
import { InputField } from "../components/forms/InputField";
import { TextInput } from "../components/forms/TextInputField";
import { LoadingButton } from "@podkit/buttons/LoadingButton";
import { MaxParallelWorkspaces } from "./policies/MaxParallelWorkspaces";
import { WorkspaceClassesEnterpriseCallout } from "./policies/WorkspaceClassesEnterpriseCallout";
import { EditorOptions } from "./policies/EditorOptions";
import { RolePermissionsRestrictions } from "./policies/RoleRestrictions";
import { OrgWorkspaceClassesOptions } from "./policies/OrgWorkspaceClassesOptions";

export default function TeamPoliciesPage() {
    useDocumentTitle("Organization Settings - Policies");
    const { toast } = useToast();
    const org = useCurrentOrg().data;
    const isOwner = useIsOwner();

    const { data: settings, isLoading } = useOrgSettingsQuery();
    const updateTeamSettings = useUpdateOrgSettingsMutation();

    const billingMode = useOrgBillingMode();
    const [workspaceTimeout, setWorkspaceTimeout] = useState<string | undefined>(undefined);
    const [allowTimeoutChangeByMembers, setAllowTimeoutChangeByMembers] = useState<boolean | undefined>(undefined);
    const [workspaceTimeoutSettingError, setWorkspaceTimeoutSettingError] = useState<string | undefined>(undefined);

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
                setWorkspaceTimeoutSettingError(undefined);
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

    useEffect(() => {
        setWorkspaceTimeout(
            settings?.timeoutSettings?.inactivity
                ? converter.toDurationString(settings.timeoutSettings.inactivity)
                : undefined,
        );
        setAllowTimeoutChangeByMembers(!settings?.timeoutSettings?.denyUserTimeouts);
    }, [settings?.timeoutSettings]);

    const handleUpdateOrganizationTimeoutSettings = useCallback(
        (e: FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            try {
                if (workspaceTimeout) {
                    WorkspaceTimeoutDuration.validate(workspaceTimeout);
                }
            } catch (error) {
                setWorkspaceTimeoutSettingError(error.message);
                return;
            }

            // Nothing has changed
            if (workspaceTimeout === undefined && allowTimeoutChangeByMembers === undefined) {
                return;
            }

            handleUpdateTeamSettings({
                timeoutSettings: {
                    inactivity: workspaceTimeout ? converter.toDuration(workspaceTimeout) : undefined,
                    denyUserTimeouts: !allowTimeoutChangeByMembers,
                },
            });
        },
        [workspaceTimeout, allowTimeoutChangeByMembers, handleUpdateTeamSettings],
    );

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
                        <Heading3>Collaboration and sharing</Heading3>

                        {updateTeamSettings.isError && (
                            <Alert type="error" closable={true} className="mb-2 max-w-xl rounded-md">
                                <span>Failed to update organization settings: </span>
                                <span>{updateTeamSettings.error.message || "unknown error"}</span>
                            </Alert>
                        )}

                        <CheckboxInputField
                            label="Workspace Sharing"
                            hint="Allow workspaces created within an Organization to share the workspace with any authenticated user."
                            checked={!settings?.workspaceSharingDisabled}
                            onChange={(checked) => handleUpdateTeamSettings({ workspaceSharingDisabled: !checked })}
                            disabled={isLoading || !isOwner}
                        />
                    </ConfigurationSettingsField>

                    <ConfigurationSettingsField>
                        <Heading3>Workspace timeouts</Heading3>
                        {!isPaidOrDedicated && (
                            <Alert type="info" className="my-3">
                                Setting Workspace timeouts is only available for organizations on a paid plan. Visit{" "}
                                <Link to={"/billing"} className="gp-link">
                                    Billing
                                </Link>{" "}
                                to upgrade your plan.
                            </Alert>
                        )}
                        <form onSubmit={handleUpdateOrganizationTimeoutSettings}>
                            <InputField
                                label="Default workspace timeout"
                                error={workspaceTimeoutSettingError}
                                hint={
                                    <span>
                                        Use minutes or hours, like <span className="font-semibold">30m</span> or{" "}
                                        <span className="font-semibold">2h</span>
                                    </span>
                                }
                            >
                                <TextInput
                                    value={workspaceTimeout ?? ""}
                                    placeholder="e.g. 30m"
                                    onChange={setWorkspaceTimeout}
                                    disabled={updateTeamSettings.isLoading || !isOwner || !isPaidOrDedicated}
                                />
                            </InputField>
                            <CheckboxInputField
                                label="Allow members to change workspace timeouts"
                                hint="Allow users to change the timeout duration for their workspaces as well as setting a default one in their user settings."
                                checked={!!allowTimeoutChangeByMembers}
                                containerClassName="my-4"
                                onChange={setAllowTimeoutChangeByMembers}
                                disabled={updateTeamSettings.isLoading || !isOwner || !isPaidOrDedicated}
                            />
                            <LoadingButton
                                type="submit"
                                loading={updateTeamSettings.isLoading}
                                disabled={
                                    !isOwner ||
                                    !isPaidOrDedicated ||
                                    (workspaceTimeout ===
                                        converter.toDurationString(settings?.timeoutSettings?.inactivity) &&
                                        allowTimeoutChangeByMembers === !settings?.timeoutSettings?.denyUserTimeouts)
                                }
                            >
                                Save
                            </LoadingButton>
                        </form>
                    </ConfigurationSettingsField>

                    <MaxParallelWorkspaces
                        isOwner={isOwner}
                        isLoading={updateTeamSettings.isLoading}
                        settings={settings}
                        handleUpdateTeamSettings={handleUpdateTeamSettings}
                        isPaidOrDedicated={isPaidOrDedicated}
                    />

                    <OrgWorkspaceClassesOptions
                        isOwner={isOwner}
                        settings={settings}
                        handleUpdateTeamSettings={handleUpdateTeamSettings}
                    />

                    {isGitpodIo() && <WorkspaceClassesEnterpriseCallout />}

                    <EditorOptions
                        isOwner={isOwner}
                        settings={settings}
                        handleUpdateTeamSettings={handleUpdateTeamSettings}
                    />

                    <RolePermissionsRestrictions
                        settings={settings}
                        isOwner={isOwner}
                        handleUpdateTeamSettings={handleUpdateTeamSettings}
                    />
                </div>
            </OrgSettingsPage>
        </>
    );
}
