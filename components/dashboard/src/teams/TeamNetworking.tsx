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
    useDocumentTitle("Organization Settings - Networking");

    if (!isGitpodIo) {
        return <Redirect to="/settings" />;
    }

    return (
        <>
            <OrgSettingsPage>
                <div className="space-y-8">
                    <div>
                        <Heading2 className="flex items-center gap-4">
                            Networking
                            <PillLabel type="warn" className="!px-3 !py-0.5 !text-xs border">
                                <span className="text-sm font-semibold text-pk-content-secondary">Enterprise</span>
                            </PillLabel>
                        </Heading2>
                        <Subheading className="mt-1">Manage your organization's networking settings.</Subheading>
                    </div>

                    <SelfHostedCalloutCard />
                    <DeployedRegionCard />
                    <VPNCard />
                </div>
            </OrgSettingsPage>
        </>
    );
}

const SelfHostedCalloutCard = () => {
    return (
        <ConfigurationSettingsField className="bg-pk-surface-secondary">
            <Heading3>Self-host in your cloud account</Heading3>
            <Subheading className="mt-1">
                Deploy the Gitpod infrastructure into your own cloud account and connect to your private network
            </Subheading>

            <div className="mt-1 flex flex-col space-y-2">
                <div className="flex flex-row gap-2 items-center text-pk-content-secondary">
                    <CheckCircle2Icon size={20} />
                    Managed application feature releases and updates
                </div>
                <div className="flex flex-row gap-2 items-center text-pk-content-secondary">
                    <CheckCircle2Icon size={20} />
                    Managed provisioning and scaling of workspaces
                </div>
                <div className="flex flex-row gap-2 items-center text-pk-content-secondary">
                    <CheckCircle2Icon size={20} />
                    Managed backup and restore processes
                </div>
                <div className="flex flex-row gap-2 items-center text-pk-content-secondary">
                    <CheckCircle2Icon size={20} />
                    Managed security updates and patches
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

const DeployedRegionCard = () => {
    return (
        <ConfigurationSettingsField className="bg-pk-surface-secondary">
            <Heading3>Choose your deployed region</Heading3>
            <Subheading className="mt-1">
                Deploy Gitpod to any location, such as: United States, South America, Europe and Asia Pacific
            </Subheading>

            <div className="mt-8 flex flex-col space-y-2">
                <div className="flex flex-row gap-2 items-center text-pk-content-secondary">
                    <CheckCircle2Icon size={20} />
                    Meet data residency compliance requirements
                </div>
                <div className="flex flex-row gap-2 items-center text-pk-content-secondary">
                    <CheckCircle2Icon size={20} />
                    Reduce your workspace latency
                </div>
            </div>

            <LinkButton
                variant="secondary"
                className="mt-8 border border-pk-content-tertiary text-pk-content-tertiary"
                href="https://www.gitpod.io/docs/enterprise/overview#aws-support-and-regions"
                isExternalUrl={true}
            >
                Dcoumentation
            </LinkButton>
        </ConfigurationSettingsField>
    );
};

const VPNCard = () => {
    return (
        <ConfigurationSettingsField className="bg-pk-surface-secondary">
            <Heading3>Virtual Private Network (VPN)</Heading3>
            <Subheading className="mt-1">
                Ensure that only your developers can access your Gitpod instance through your VPN network
            </Subheading>

            <LinkButton
                variant="secondary"
                className="mt-8 border border-pk-content-tertiary text-pk-content-tertiary"
                href="https://www.gitpod.io/docs/enterprise/getting-started/networking#private-networking-configuration-highly-restrictive"
                isExternalUrl={true}
            >
                Dcoumentation
            </LinkButton>
        </ConfigurationSettingsField>
    );
};
