import { SettingsPage } from "../components/SettingsPage";
import settingsMenu from './settings-menu';

export default function GitIntegration() {
    return <div>
        <SettingsPage title='Settings' subtitle='Manage integration with your Git hosters' menuEntries={settingsMenu}>
            <div className="lg:px-28 px-10 flex pt-10">
                Git Hoster Access Control
            </div>
        </SettingsPage>
    </div>;
}