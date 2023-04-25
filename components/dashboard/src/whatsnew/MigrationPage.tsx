/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useMutation } from "@tanstack/react-query";
import { OnboardingStep } from "../onboarding/OnboardingStep";
import { User } from "@gitpod/gitpod-protocol";
import { getGitpodService } from "../service/service";
import { useOrganizationsInvalidator } from "../data/organizations/orgs-query";
import { Separator } from "../components/Separator";
import gitpodIcon from "../icons/gitpod.svg";
import { useContext } from "react";
import { UserContext, useCurrentUser } from "../user-context";
import { Heading3 } from "../components/typography/headings";
import { Link } from "react-router-dom";

export function MigrationPage() {
    const migrateUsers = useMigrateUserMutation();
    const user = useCurrentUser();

    return (
        <div className="container">
            <div className="app-container">
                <div className="flex items-center justify-center py-3">
                    <img src={gitpodIcon} className="h-6" alt="Gitpod's logo" />
                </div>
                <Separator />
                <div className="mt-24">
                    <OnboardingStep
                        title="It's now easier to collaborate"
                        subtitle="Your personal account is now an organization."
                        isValid={true}
                        isSaving={migrateUsers.isLoading}
                        onSubmit={migrateUsers.mutateAsync}
                    >
                        <Heading3>What's different?</Heading3>
                        <p className="text-gray-500 text-base mb-4">
                            Your personal account (<b>{user?.fullName || user?.name}</b>) is converted to an
                            organization. Any workspaces, projects and configuration has been moved with it.
                            Additionally, usage cost will now be attributed to the organization that owns the workspace,
                            allowing for better cost control.{" "}
                            <a className="gp-link" href="https://gitpod.io/blog/organizations">
                                Learn more -&gt;
                            </a>
                        </p>
                        <Heading3>Who has access to this organization?</Heading3>
                        <p className="text-gray-500 text-base mb-4">
                            Just you. You are the only member of this organization. You can invite members to join your
                            org or continue working by yourself.
                        </p>
                        <Heading3>What do I need to do?</Heading3>
                        <p className="text-gray-500 text-base mb-4">
                            Nothing. There are no changes to your resources or monthly cost. You can manage organization
                            settings, billing, or invite others to your organization at any time.
                        </p>
                    </OnboardingStep>
                </div>
            </div>
        </div>
    );
}

function useMigrateUserMutation() {
    const invalidateOrgs = useOrganizationsInvalidator();
    const { setUser } = useContext(UserContext);

    return useMutation<User, Error>({
        mutationFn: async () => {
            const user = await getGitpodService().server.migrateLoggedInUserToOrgOnlyMode();
            setUser(user);
            return user;
        },
        onSuccess(updatedOrg) {
            invalidateOrgs();
        },
    });
}
