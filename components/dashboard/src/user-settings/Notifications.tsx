/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useState } from "react";
import { CheckboxInputField } from "../components/forms/CheckboxInputField";
import { identifyUser } from "../Analytics";
import { PageWithSettingsSubMenu } from "./PageWithSettingsSubMenu";
import { Heading2 } from "../components/typography/headings";
import { useAuthenticatedUser } from "../data/current-user/authenticated-user-query";
import { useUpdateCurrentUserMutation } from "../data/current-user/update-mutation";

export default function Notifications() {
    const { data: user, refetch: reloadUser } = useAuthenticatedUser();
    const [isOnboardingMail, setOnboardingMail] = useState(!!user?.emailNotificationSettings?.allowsOnboardingMail);
    const [isChangelogMail, setChangelogMail] = useState(!!user?.emailNotificationSettings?.allowsChangelogMail);
    const [isDevXMail, setDevXMail] = useState(!!user?.emailNotificationSettings?.allowsDevxMail);
    const updateUser = useUpdateCurrentUserMutation();

    const toggleOnboardingMail = async () => {
        if (user && user.emailNotificationSettings) {
            const newIsOnboardingMail = !isOnboardingMail;
            user.emailNotificationSettings.allowsOnboardingMail = newIsOnboardingMail;
            await updateUser.mutateAsync({
                additionalData: {
                    emailNotificationSettings: {
                        allowsOnboardingMail: newIsOnboardingMail,
                    },
                },
            });
            await reloadUser();
            identifyUser({ unsubscribed_onboarding: !newIsOnboardingMail });
            setOnboardingMail(newIsOnboardingMail);
        }
    };

    const toggleChangelogMail = async () => {
        if (user && user.emailNotificationSettings) {
            const newIsChangelogMail = !isChangelogMail;
            user.emailNotificationSettings.allowsChangelogMail = newIsChangelogMail;
            await updateUser.mutateAsync({
                additionalData: {
                    emailNotificationSettings: {
                        allowsChangelogMail: newIsChangelogMail,
                    },
                },
            });
            await reloadUser();
            identifyUser({ unsubscribed_changelog: !newIsChangelogMail });
            setChangelogMail(newIsChangelogMail);
        }
    };

    const toggleDevXMail = async () => {
        if (user && user.emailNotificationSettings) {
            const newIsDevXMail = !isDevXMail;
            user.emailNotificationSettings.allowsDevxMail = newIsDevXMail;
            await updateUser.mutateAsync({
                additionalData: {
                    emailNotificationSettings: {
                        allowsDevXMail: newIsDevXMail,
                    },
                },
            });
            identifyUser({ unsubscribed_devx: !newIsDevXMail });
            setDevXMail(newIsDevXMail);
        }
    };

    return (
        <div>
            <PageWithSettingsSubMenu>
                <Heading2>Email Notifications</Heading2>
                <CheckboxInputField
                    label="Onboarding guide"
                    hint="In the first weeks after you sign up, we'll guide you through the product, so you can get the most out of it"
                    checked={isOnboardingMail}
                    onChange={toggleOnboardingMail}
                />
                <CheckboxInputField
                    label="Changelog"
                    hint="Be the first to learn about new features and overall product improvements"
                    checked={isChangelogMail}
                    onChange={toggleChangelogMail}
                />
                <CheckboxInputField
                    label="Developer Experience & Product Tips"
                    hint="Bring back joy and speed to your workflows"
                    checked={isDevXMail}
                    onChange={toggleDevXMail}
                />
            </PageWithSettingsSubMenu>
        </div>
    );
}
