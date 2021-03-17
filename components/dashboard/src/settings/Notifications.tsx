import { SettingsPage } from "../components/SettingsPage";
import settingsMenu from "./settings-menu";

export default function Notifications() {
    return <div>
        <SettingsPage title='Notifications' subtitle='Email notification preferences' menuEntries={settingsMenu}>
            <h3>Notifications</h3>
        </SettingsPage>
    </div>;
}
