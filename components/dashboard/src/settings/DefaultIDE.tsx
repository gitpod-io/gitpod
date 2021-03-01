import { SettingsPage } from "../components/SettingsPage";
import settingsMenu from './settings-menu';

export default function DefaultIDE() {
    return <div>
        <SettingsPage title='Settings' subtitle='Configure your default IDE' menuEntries={settingsMenu}>
            <div className="lg:px-28 px-10 flex pt-10">
                Default IDE
            </div>
        </SettingsPage>
    </div>;
}