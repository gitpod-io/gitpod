/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FunctionComponent } from "react";
import { Redirect } from "react-router";
import Header from "../components/Header";
import { SpinnerLoader } from "../components/Loader";
import { useCurrentOrg } from "../data/organizations/orgs-query";
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
    const currentOrg = useCurrentOrg();

    // Render as much of the page as we can in a loading state to avoid content shift
    if (currentOrg.isLoading) {
        return (
            <div className="w-full">
                <Header title="Organization Settings" subtitle="Manage your organization's settings." />
                <div className="w-full">
                    <SpinnerLoader />
                </div>
            </div>
        );
    }

    if (!currentOrg.data?.isOwner) {
        return <Redirect to={"/"} />;
    }

    return <OrgSettingsPage>{children}</OrgSettingsPage>;
};
