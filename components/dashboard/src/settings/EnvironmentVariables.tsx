import { SettingsPage } from "../components/SettingsPage";
import settingsMenu from './settings-menu';

export default function EnvVars() {
    return <div>
        <SettingsPage title='Environment Variables' subtitle='Configure environment variables for your workspaces' menuEntries={settingsMenu}>
            <h3>Environment Variables</h3>
        </SettingsPage>
    </div>;
}