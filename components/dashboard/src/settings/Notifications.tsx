/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { useContext } from "react";
import { getGitpodService } from "../service/service";
import { UserContext } from "../user-context";
import CheckBox from "../components/CheckBox";
import { PageWithSubMenu } from "../components/PageWithSubMenu";
import settingsMenu from "./settings-menu";

export default function Notifications() {
    const ctx = useContext(UserContext);
    const user = ctx.user;
    const isTransactionalMail = !user?.additionalData?.emailNotificationSettings?.disallowTransactionalEmails;
    const toggleTransactionalMail = async ()=>{
        if (user) {
            user.additionalData = {
                ... {
                    ... user.additionalData,
                    emailNotificationSettings: {
                        ... user.additionalData?.emailNotificationSettings,
                        disallowTransactionalEmails: !!isTransactionalMail
                    }
                }
            }
            await getGitpodService().server.updateLoggedInUser({
                additionalData: user.additionalData
            });
            ctx.setUser(user);
        }
    };
    const isMarketingMail = !!user?.allowsMarketingCommunication;
    const toggleMarketingMail = async ()=> {
        if (user) {
            user.allowsMarketingCommunication = !user?.allowsMarketingCommunication;
            await getGitpodService().server.updateLoggedInUser({
                allowsMarketingCommunication: user.allowsMarketingCommunication
            });
            ctx.setUser(user);
        }
    }
    return <div>
        <PageWithSubMenu subMenu={settingsMenu}  title='Notifications' subtitle='Choose when to be notified.'>
            <h3>Email Notification Preferences</h3>
            <CheckBox 
                title="Account Notifications" 
                desc="Receive emails about changes to your account"
                checked={isTransactionalMail}
                onChange={toggleTransactionalMail}/>
            <CheckBox 
                title="Marketing Notifications" 
                desc="Receive product marketing emails"
                checked={isMarketingMail}
                onChange={toggleMarketingMail}/>
        </PageWithSubMenu>
    </div>;
}
