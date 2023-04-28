/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { OnboardingStep } from "../onboarding/OnboardingStep";
import { User } from "@gitpod/gitpod-protocol";
import { getGitpodService } from "../service/service";
import { useOrganizationsInvalidator } from "../data/organizations/orgs-query";
import { Separator } from "../components/Separator";
import gitpodIcon from "../icons/gitpod.svg";
import { useContext } from "react";
import { UserContext, useCurrentUser } from "../user-context";
import { Heading3 } from "../components/typography/headings";
import { useFeatureFlag } from "../data/featureflag-query";

namespace SkipMigration {
    const key = "skip-migration";
    interface SkipInfo {
        validUntil: string;
        timesSkipped: number;
    }

    function useGetSkipInfo() {
        return useQuery([key], () => {
            const skippedSerialized = window.localStorage.getItem(key);
            const skipped = skippedSerialized ? (JSON.parse(skippedSerialized) as SkipInfo) : undefined;
            return skipped || null;
        });
    }

    export function useIsSkipped(): boolean {
        const skipped = useGetSkipInfo();
        return !!skipped.data && skipped.data.validUntil > new Date().toISOString();
    }

    export function useCanSkip(): boolean {
        const skipped = useGetSkipInfo();
        return !skipped.data || skipped.data.timesSkipped < 3;
    }

    export function useMarkSkipped() {
        const queryClient = useQueryClient();
        const currentSkip = useGetSkipInfo();
        return useMutation({
            mutationFn: async () => {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                const info: SkipInfo = {
                    validUntil: tomorrow.toISOString(),
                    timesSkipped: currentSkip.data ? currentSkip.data.timesSkipped + 1 : 1,
                };
                window.localStorage.setItem(key, JSON.stringify(info));
                return info;
            },
            onSuccess: (info) => {
                queryClient.invalidateQueries({ queryKey: [key] });
            },
        });
    }
}

export function useShouldSeeMigrationPage(): boolean {
    const user = useCurrentUser();
    const isSkipped = SkipMigration.useIsSkipped();
    const orgOnlyAttribution = useFeatureFlag("team_only_attribution");
    return !!user && !user.additionalData?.isMigratedToTeamOnlyAttribution && orgOnlyAttribution && !isSkipped;
}

export function MigrationPage() {
    const migrateUsers = useMigrateUserMutation();
    const user = useCurrentUser();
    const canSkip = SkipMigration.useCanSkip();
    const markSkipped = SkipMigration.useMarkSkipped();
    const skipForNow = canSkip ? markSkipped.mutate : undefined;

    return (
        <div className="container">
            <div className="app-container">
                <div className="flex items-center justify-center py-3">
                    <img src={gitpodIcon} className="h-6" alt="Gitpod's logo" />
                </div>
                <Separator />
                <div className="mt-24">
                    <OnboardingStep
                        title="It's getting easier to collaborate"
                        subtitle="Your personal account is turned into an organization."
                        isValid={true}
                        isSaving={migrateUsers.isLoading}
                        onSubmit={migrateUsers.mutateAsync}
                        onCancel={skipForNow}
                        cancelButtonText="Ask me later"
                    >
                        <Heading3>What's different?</Heading3>
                        <p className="text-gray-500 text-base mb-4">
                            Your personal account (<b>{user?.fullName || user?.name}</b>) is converted to an
                            organization. As part of this any of your personal workspaces, projects, and configurations
                            are moved to that organization. Additionally, after this step usage cost is always
                            attributed to the currently selected organization, allowing for better cost control.{" "}
                            <a className="gp-link" href="https://gitpod.io/blog/organizations">
                                Learn more →
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
