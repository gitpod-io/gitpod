import { SettingsPage } from "../components/SettingsPage";
import accountMenu from "./account-menu";

export default function Notifications() {
    return <div>
        <SettingsPage title='Account' subtitle='Notifications' menuEntries={accountMenu}>
            <div className="lg:px-28 px-10 flex pt-10">
                Usage
            </div>
        </SettingsPage>
    </div>;
}
