/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useContext, useState } from "react";
import { getGitpodService } from "../service/service";
import { UserContext } from "../user-context";
import { CheckboxInputField } from "../components/forms/CheckboxInputField";
import { identifyUser } from "../Analytics";
import { PageWithSettingsSubMenu } from "./PageWithSettingsSubMenu";
import { Heading2 } from "../components/typography/headings";

export default function Notifications() {
    const { user, setUser } = useContext(UserContext);
    const [isOnboardingMail, setOnboardingMail] = useState(
        !!user?.additionalData?.emailNotificationSettings?.allowsOnboardingMail,
    );
    const [isChangelogMail, setChangelogMail] = useState(
        !!user?.additionalData?.emailNotificationSettings?.allowsChangelogMail,
    );
    const [isDevXMail, setDevXMail] = useState(!!user?.additionalData?.emailNotificationSettings?.allowsDevXMail);

    const toggleOnboardingMail = async () => {
        if (user?.additionalData?.emailNotificationSettings) {
            const newIsOnboardingMail = !isOnboardingMail;
            user.additionalData.emailNotificationSettings.allowsOnboardingMail = newIsOnboardingMail;
            await getGitpodService().server.updateLoggedInUser({
                additionalData: {
                    ...user.additionalData,
                    emailNotificationSettings: {
                        ...user.additionalData.emailNotificationSettings,
                        allowsOnboardingMail: newIsOnboardingMail,
                    },
                },
            });
            identifyUser({ unsubscribed_onboarding: !newIsOnboardingMail });
            setUser(user);
            setOnboardingMail(newIsOnboardingMail);
        }
    };

    const toggleChangelogMail = async () => {
        if (user?.additionalData?.emailNotificationSettings) {
            const newIsChangelogMail = !isChangelogMail;
            user.additionalData.emailNotificationSettings.allowsChangelogMail = newIsChangelogMail;
            await getGitpodService().server.updateLoggedInUser({
                additionalData: {
                    ...user.additionalData,
                    emailNotificationSettings: {
                        ...user.additionalData.emailNotificationSettings,
                        allowsChangelogMail: newIsChangelogMail,
                    },
                },
            });
            identifyUser({ unsubscribed_changelog: !newIsChangelogMail });
            setUser(user);
            setChangelogMail(newIsChangelogMail);
        }
    };

    const toggleDevXMail = async () => {
        if (user?.additionalData?.emailNotificationSettings) {
            const newIsDevXMail = !isDevXMail;
            user.additionalData.emailNotificationSettings.allowsDevXMail = newIsDevXMail;
            await getGitpodService().server.updateLoggedInUser({
                additionalData: {
                    ...user.additionalData,
                    emailNotificationSettings: {
                        ...user.additionalData.emailNotificationSettings,
                        allowsDevXMail: newIsDevXMail,
                    },
                },
            });
            identifyUser({ unsubscribed_devx: !newIsDevXMail });
            setUser(user);
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
