import { SettingsPage } from "./SettingsPage";

export default function EnvVars() {
    return <div>
        <SettingsPage title='Variables' subtitle='Configure environment variables for all workspaces.'>
            <h3>Environment Variables</h3>
        </SettingsPage>
    </div>;
}