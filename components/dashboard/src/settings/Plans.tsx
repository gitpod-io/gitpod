import { SettingsPage } from "../components/SettingsPage";
import settingsMenu from "./settings-menu";

export default function Plans() {
    return <div>
        <SettingsPage title='Plans' subtitle='Plans and Usage' menuEntries={settingsMenu} >
            <h3>Plans</h3>
        </SettingsPage>
    </div>;
}

