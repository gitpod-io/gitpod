/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { useContext, useState } from "react";
import { getGitpodService } from "../service/service";
import { UserContext } from "../user-context";
import CheckBox from "../components/CheckBox";
import { PageWithSubMenu } from "../components/PageWithSubMenu";
import settingsMenu from "./settings-menu";

export default function Notifications() {
    const { user, setUser } = useContext(UserContext);
    const [isOnboardingMail, setOnboardingMail] = useState(!!user?.additionalData?.emailNotificationSettings?.allowsOnboardingMail);
    const [isChangelogMail, setChangelogMail] = useState(!!user?.additionalData?.emailNotificationSettings?.allowsChangelogMail);
    const [isDevXMail, setDevXMail] = useState(!!user?.additionalData?.emailNotificationSettings?.allowsDevXMail);

    const toggleOnboardingMail = async () => {
        if (user && user.additionalData && user.additionalData.emailNotificationSettings) {
            const newIsOnboardingMail = !isOnboardingMail;
            user.additionalData.emailNotificationSettings.allowsOnboardingMail = newIsOnboardingMail;
            await getGitpodService().server.updateLoggedInUser({
                additionalData: {
                    ...user.additionalData,
                    emailNotificationSettings: {
                        ...user.additionalData.emailNotificationSettings,
                        allowsOnboardingMail: newIsOnboardingMail
                    }
                }
            });
            await getGitpodService().server.identifyUser({
                traits: { "unsubscribed_onboarding": !newIsOnboardingMail }
            })
            setUser(user);
            setOnboardingMail(newIsOnboardingMail);
        }
    }

    const toggleChangelogMail = async () => {
        if (user && user.additionalData && user.additionalData.emailNotificationSettings) {
            const newIsChangelogMail = !isChangelogMail;
            user.additionalData.emailNotificationSettings.allowsChangelogMail = newIsChangelogMail;
            await getGitpodService().server.updateLoggedInUser({
                additionalData: {
                    ...user.additionalData,
                    emailNotificationSettings: {
                        ...user.additionalData.emailNotificationSettings,
                        allowsChangelogMail: newIsChangelogMail
                    }
                }
            });
            await getGitpodService().server.identifyUser({
                traits: { "unsubscribed_changelog": !newIsChangelogMail }
            })
            setUser(user);
            setChangelogMail(newIsChangelogMail);
        }
    }

    const toggleDevXMail = async () => {
        if (user && user.additionalData && user.additionalData.emailNotificationSettings) {
            const newIsDevXMail = !isDevXMail
            user.additionalData.emailNotificationSettings.allowsDevXMail = newIsDevXMail;
            await getGitpodService().server.updateLoggedInUser({
                additionalData: {
                    ...user.additionalData,
                    emailNotificationSettings: {
                        ...user.additionalData.emailNotificationSettings,
                        allowsDevXMail: newIsDevXMail
                    }
                }
            });
            await getGitpodService().server.identifyUser({
                traits: { "unsubscribed_devx": !newIsDevXMail }
            })
            setUser(user);
            setDevXMail(newIsDevXMail);
        }
    }

    return (
    <div>
        <PageWithSubMenu subMenu={settingsMenu} title='Notifications' subtitle='Choose when to be notified.'>
            <h3>Email Notification Preferences</h3>
            <CheckBox
                title="Account Notifications [required]"
                desc="Receive essential emails about changes to your account"
                checked={true}
                disabled={true} />
            <CheckBox
                title="Onboarding guide"
                desc="In the first weeks after you sign up, we'll guide you through the product, so you can get the most out of it"
                checked={isOnboardingMail}
                onChange={toggleOnboardingMail} />
            <CheckBox
                title="Changelog"
                desc="Be the first to learn about new features and overall product improvements"
                checked={isChangelogMail}
                onChange={toggleChangelogMail} />
            <CheckBox
                title="Developer Experience & Product Tips"
                desc="Bring back joy and speed to your workflows"
                checked={isDevXMail}
                onChange={toggleDevXMail} />
        </PageWithSubMenu>
    </div>
    )
}