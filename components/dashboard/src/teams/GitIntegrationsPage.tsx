/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FunctionComponent, useMemo } from "react";
import { Redirect } from "react-router";
import Header from "../components/Header";
import { SpinnerLoader } from "../components/Loader";
import { useOrgBillingMode } from "../data/billing-mode/org-billing-mode-query";
import { useCurrentOrgMember } from "../data/organizations/org-members-query";
import { GitIntegrations } from "./git-integrations/GitIntegrations";
import { OrgSettingsPage } from "./OrgSettingsPage";

export default function GitAuth() {
    return (
        <OrgSettingsPageWrapper>
            <GitIntegrations />
        </OrgSettingsPageWrapper>
    );
}

// TODO: Refactor this into OrgSettingsPage so each page doesn't have to do this
export const OrgSettingsPageWrapper: FunctionComponent = ({ children }) => {
    const { isLoading: isBillingModeLoading } = useOrgBillingMode();
    const { member, isLoading: isMemberInfoLoading } = useCurrentOrgMember();

    const isLoading = useMemo(
        () => isBillingModeLoading || isMemberInfoLoading,
        [isBillingModeLoading, isMemberInfoLoading],
    );

    const isOwner = useMemo(() => {
        return member?.role === "owner";
    }, [member?.role]);

    // Render as much of the page as we can in a loading state to avoid content shift
    if (isLoading) {
        return (
            <div className="w-full">
                <Header title="Organization Settings" subtitle="Manage your organization's settings." />
                <div className="w-full">
                    <SpinnerLoader />
                </div>
            </div>
        );
    }

    if (!isOwner) {
        return <Redirect to={"/"} />;
    }

    return <OrgSettingsPage>{children}</OrgSettingsPage>;
};
