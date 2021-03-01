import { SettingsPage } from "../components/SettingsPage";
import accountMenu from "./account-menu";

export default function Subscriptions() {
    return <div>
        <SettingsPage title='Account' subtitle='Plans and Usage' menuEntries={accountMenu} >
            <div className="lg:px-28 px-10 flex pt-10">
                Subscriptions
            </div>
        </SettingsPage>
    </div>;
}

