import { SettingsPage } from "../components/SettingsPage";
import settingsMenu from './settings-menu';

export default function FeaturePreview() {
    return <div>
        <SettingsPage title='Settings' subtitle='Try the latest features today' menuEntries={settingsMenu}>
            <div className="lg:px-28 px-10 flex pt-10">
                Feature Preview
            </div>
        </SettingsPage>
    </div>;
}