/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useContext, useState } from "react";
import { UserContext } from "../user-context";
import { CheckboxInputField } from "../components/forms/CheckboxInputField";
import { identifyUser } from "../Analytics";
import { PageWithSettingsSubMenu } from "./PageWithSettingsSubMenu";
import { Heading2 } from "../components/typography/headings";
import { useUpdateCurrentUserMutation } from "../data/current-user/update-mutation";

export default function Notifications() {
    const { user, setUser } = useContext(UserContext);
    const [isOnboardingMail, setOnboardingMail] = useState(!!user?.emailNotificationSettings?.allowsOnboardingMail);
    const [isChangelogMail, setChangelogMail] = useState(!!user?.emailNotificationSettings?.allowsChangelogMail);
    const [isDevXMail, setDevXMail] = useState(!!user?.emailNotificationSettings?.allowsDevxMail);
    const updateUser = useUpdateCurrentUserMutation();

    const toggleOnboardingMail = async () => {
        if (user && user.emailNotificationSettings) {
            const newIsOnboardingMail = !isOnboardingMail;
            user.emailNotificationSettings.allowsOnboardingMail = newIsOnboardingMail;
            const updatedUser = await updateUser.mutateAsync({
                additionalData: {
                    emailNotificationSettings: {
                        allowsOnboardingMail: newIsOnboardingMail,
                    },
                },
            });
            identifyUser({ unsubscribed_onboarding: !newIsOnboardingMail });
            setUser(updatedUser);
            setOnboardingMail(newIsOnboardingMail);
        }
    };

    const toggleChangelogMail = async () => {
        if (user && user.emailNotificationSettings) {
            const newIsChangelogMail = !isChangelogMail;
            user.emailNotificationSettings.allowsChangelogMail = newIsChangelogMail;
            const updatedUser = await updateUser.mutateAsync({
                additionalData: {
                    emailNotificationSettings: {
                        allowsChangelogMail: newIsChangelogMail,
                    },
                },
            });
            identifyUser({ unsubscribed_changelog: !newIsChangelogMail });
            setUser(updatedUser);
            setChangelogMail(newIsChangelogMail);
        }
    };

    const toggleDevXMail = async () => {
        if (user && user.emailNotificationSettings) {
            const newIsDevXMail = !isDevXMail;
            user.emailNotificationSettings.allowsDevxMail = newIsDevXMail;
            const updatedUser = await updateUser.mutateAsync({
                additionalData: {
                    emailNotificationSettings: {
                        allowsDevXMail: newIsDevXMail,
                    },
                },
            });
            identifyUser({ unsubscribed_devx: !newIsDevXMail });
            setUser(updatedUser);
            setDevXMail(newIsDevXMail);
        }
    };

    return (
        <div>
            <PageWithSettingsSubMenu>
                <Heading2>Email notifications</Heading2>
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
                    label="Developer experience & product tips"
                    hint="Bring back joy and speed to your workflows"
                    checked={isDevXMail}
                    onChange={toggleDevXMail}
                />
            </PageWithSettingsSubMenu>
        </div>
    );
}
