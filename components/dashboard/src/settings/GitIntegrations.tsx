import { SettingsPage } from "../components/SettingsPage";
import settingsMenu from './settings-menu';

export default function GitIntegrations() {
    return <div>
        <SettingsPage title='Git Integrations' subtitle='Manage integration with your Git hosters' menuEntries={settingsMenu}>
            <h3>Git Hoster Access Control</h3>
        </SettingsPage>
    </div>;
}