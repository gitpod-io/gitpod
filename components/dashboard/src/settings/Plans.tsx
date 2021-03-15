import { SettingsPage } from "../components/SettingsPage";
import settingsMenu from "./settings-menu";

export default function Plans() {
    return <div>
        <SettingsPage title='Plans' subtitle='Plans and Usage' menuEntries={settingsMenu} >
            <div className="lg:px-28 px-10 flex pt-10">
                Plans
            </div>
        </SettingsPage>
    </div>;
}

