import { SettingsPage } from "../components/SettingsPage";
import settingsMenu from './settings-menu';

export default function EnvVars() {
    return <div>
        <SettingsPage title='Settings' subtitle='Configure environment variables for your workspaces' menuEntries={settingsMenu}>
            <div className="lg:px-28 px-10 flex pt-10">
                Env Vars
            </div>
        </SettingsPage>
    </div>;
}