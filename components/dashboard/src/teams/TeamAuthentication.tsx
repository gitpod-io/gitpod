/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { isGitpodIo } from "../utils";
import React from "react";
import { Heading2, Heading3, Subheading } from "../components/typography/headings";
import { OrgSettingsPage } from "./OrgSettingsPage";
import { ConfigurationSettingsField } from "../repositories/detail/ConfigurationSettingsField";
import { useDocumentTitle } from "../hooks/use-document-title";
import { LinkButton } from "@podkit/buttons/LinkButton";
import { CheckCircle2Icon } from "lucide-react";
import { Redirect } from "react-router";
import PillLabel from "../components/PillLabel";

export default function TeamPoliciesPage() {
    useDocumentTitle("Organization Settings - Authentication");

    if (!isGitpodIo) {
        return <Redirect to="/settings" />;
    }

    return (
        <>
            <OrgSettingsPage>
                <div className="space-y-8">
                    <div>
                        <Heading2 className="flex items-center gap-4">
                            Authentication
                            <PillLabel type="warn">Enterprise</PillLabel>
                        </Heading2>
                        <Subheading className="mt-1">
                            Manage users through single sign-on and privately authenticate with source control and image
                            registries.
                        </Subheading>
                    </div>

                    <SSOCard />
                    <PrivateImageRegistryCard />
                    <PrivateSourceControlAccess />
                </div>
            </OrgSettingsPage>
        </>
    );
}

const SSOCard = () => {
    return (
        <ConfigurationSettingsField className="bg-pk-surface-secondary">
            <Heading3>Single sign-on (SSO)</Heading3>
            <Subheading className="mt-1">More control over workspace access for your organization</Subheading>

            <div className="mt-8 flex flex-col space-y-2">
                <div className="flex flex-row gap-2 items-center text-pk-content-secondary">
                    <CheckCircle2Icon size={20} className="text-pk-content-primary" />
                    Includes support for Google, Okta, AWS Cognito and others
                </div>
                <div className="flex flex-row gap-2 items-center text-pk-content-secondary">
                    <CheckCircle2Icon size={20} className="text-pk-content-primary" />
                    Instantly revoke access and off-board users from Gitpod
                </div>
            </div>

            <LinkButton
                href="https://www.gitpod.io/contact/enterprise-self-serve"
                isExternalUrl={true}
                className="mt-8"
            >
                Request Free Trial
            </LinkButton>
        </ConfigurationSettingsField>
    );
};

const PrivateImageRegistryCard = () => {
    return (
        <ConfigurationSettingsField className="bg-pk-surface-secondary">
            <Heading3>Private container image registry</Heading3>
            <Subheading className="mt-1">Provide secure access to private image registries such as ECR</Subheading>

            <LinkButton
                variant="secondary"
                className="mt-8 border border-pk-content-tertiary text-pk-content-primary bg-pk-surface-primary"
                href="https://www.gitpod.io/docs/enterprise/setup-gitpod/use-private-ecr-repos-for-workspace-images"
                isExternalUrl={true}
            >
                Documentation
            </LinkButton>
        </ConfigurationSettingsField>
    );
};

const PrivateSourceControlAccess = () => {
    return (
        <ConfigurationSettingsField className="bg-pk-surface-secondary">
            <Heading3>Private source control access</Heading3>
            <Subheading className="mt-1">
                Connect to your private source control like GitHub, BitBucket and GitLab
            </Subheading>

            <LinkButton
                variant="secondary"
                className="mt-8 border border-pk-content-tertiary text-pk-content-primary bg-pk-surface-primary"
                href="https://www.gitpod.io/docs/enterprise/setup-gitpod/scm-integration"
                isExternalUrl={true}
            >
                Documentation
            </LinkButton>
        </ConfigurationSettingsField>
    );
};
