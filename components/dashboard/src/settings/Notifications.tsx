import { SettingsPage } from "../components/SettingsPage";
import settingsMenu from "./settings-menu";

export default function Notifications() {
    return <div>
        <SettingsPage title='Notifications' subtitle='Email notification preferences' menuEntries={settingsMenu}>
            <div className="lg:px-28 px-10 flex pt-10">
                Notifications
            </div>
        </SettingsPage>
    </div>;
}
