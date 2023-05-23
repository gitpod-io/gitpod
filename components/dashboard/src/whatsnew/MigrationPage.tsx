/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { AdditionalUserData, User } from "@gitpod/gitpod-protocol";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useContext } from "react";
import { Separator } from "../components/Separator";
import { Heading3 } from "../components/typography/headings";
import gitpodIcon from "../icons/gitpod.svg";
import { OnboardingStep } from "../onboarding/OnboardingStep";
import { getGitpodService } from "../service/service";
import { UserContext, useCurrentUser } from "../user-context";

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

    export function clearSkipInfo() {
        window.localStorage.removeItem(key);
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
    return !!user && !!user.additionalData?.shouldSeeMigrationMessage && !isSkipped;
}

export function MigrationPage() {
    const markRead = useMarkMessageReadMutation();
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
                        subtitle="Your personal account has turned into an organization."
                        isValid={true}
                        isSaving={markRead.isLoading}
                        onSubmit={markRead.mutateAsync}
                        onCancel={skipForNow}
                        cancelButtonText="Read later"
                    >
                        <Heading3>What's different?</Heading3>
                        <p className="text-gray-500 text-base mb-4">
                            Your personal account (<b>{user?.fullName || user?.name}</b>) was converted to an
                            organization. As part of this any of your personal workspaces, projects, and configurations
                            have moved to that organization. Additionally, usage cost is now always attributed to the
                            currently selected organization, allowing for better cost control.{" "}
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

function useMarkMessageReadMutation() {
    const { user, setUser } = useContext(UserContext);

    return useMutation<User, Error>({
        mutationFn: async () => {
            if (!user) {
                throw new Error("No user");
            }
            let updatedUser = AdditionalUserData.set(user, { shouldSeeMigrationMessage: false });
            updatedUser = await getGitpodService().server.updateLoggedInUser(updatedUser);
            SkipMigration.clearSkipInfo();
            setUser(updatedUser);
            return updatedUser;
        },
    });
}
