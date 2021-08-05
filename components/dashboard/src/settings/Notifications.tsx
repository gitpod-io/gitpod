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

    const [isChangelogMail, setChangelogMail] = useState(!!user?.additionalData?.emailNotificationSettings?.allowsChangelogMail);
    const toggleChangelogMail = async () => {
        if (user && user.additionalData && user.additionalData.emailNotificationSettings) {
            await getGitpodService().server.updateLoggedInUser({
                additionalData: {
                    ...user.additionalData,
                    emailNotificationSettings: {
                        ...user.additionalData.emailNotificationSettings,
                        allowsChangelogMail: !isChangelogMail
                    }
                }
            });
            await getGitpodService().server.trackEvent({
                event: "notification_change",
                properties: { "unsubscribed_changelog": isChangelogMail }
            })
            setUser(user);
            setChangelogMail(!isChangelogMail);
        }
    }

    const [isDevXMail, setDevXMail] = useState(!!user?.additionalData?.emailNotificationSettings?.allowsDevXMail);
    const toggleDevXMail = async () => {
        if (user && user.additionalData && user.additionalData.emailNotificationSettings) {
            await getGitpodService().server.updateLoggedInUser({
                additionalData: {
                    ...user.additionalData,
                    emailNotificationSettings: {
                        ...user.additionalData.emailNotificationSettings,
                        allowsDevXMail: !isDevXMail
                    }
                }
            });
            await getGitpodService().server.trackEvent({
                event: "notification_change",
                properties: { "unsubscribed_devx": isDevXMail }
            })
            setUser(user);
            setDevXMail(!isDevXMail);
        }
    }
    return <div>
        <PageWithSubMenu subMenu={settingsMenu} title='Notifications' subtitle='Choose when to be notified.'>
            <h3>Email Notification Preferences</h3>
            <CheckBox
                title="Account Notifications [required]"
                desc="Receive essential emails about changes to your account"
                checked={true}
                disabled={true} />
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
    </div>;
}
