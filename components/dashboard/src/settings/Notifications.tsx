import { useContext } from "react";
import { SettingsPage } from "./SettingsPage";
import { getGitpodService } from "../service/service";
import { UserContext } from "../user-context";

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
        <SettingsPage title='Notifications' subtitle='Choose when to be notified.'>
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
        </SettingsPage>
    </div>;
}

function CheckBox(props: {title: string, desc: string, checked: boolean, onChange: () => void}) {
    return <div className="flex mt-4">
        <input className={"h-5 w-5 focus:ring-0 mt-1 rounded cursor-pointer border-2 "+(props.checked?'bg-gray-800':'')} type="checkbox" checked={props.checked} onChange={props.onChange}/>
        <div className="flex flex-col ml-2">
            <div className="text-gray-700 text-md font-semibold">{props.title}</div>
            <div className="text-gray-400 text-md">{props.desc}</div>
        </div>
    </div>
}
