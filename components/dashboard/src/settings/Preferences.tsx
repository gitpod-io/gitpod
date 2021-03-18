import { useContext, useState } from "react";
import { getGitpodService } from "../service/service";
import SelectableCard from "../components/SelectableCard";
import { UserContext } from "../user-context";
import { SettingsPage } from "./SettingsPage";

export default function Preferences() {
    const [ hasIDESettingsPermissions, setHasIDESettingsPermissions ] = useState<boolean | undefined>(undefined);
    if (hasIDESettingsPermissions === undefined) {
        getGitpodService().server.hasPermission('ide-settings').then(hasPermission => setHasIDESettingsPermissions(hasPermission));
    }

    const { user } = useContext(UserContext);
    const [ defaultIde, setDefaultIde ] = useState<string>(user?.additionalData?.ideSettings?.defaultIde || 'theia');
    const actuallySetDefaultIde = async (value: string) => {
        const additionalData = user?.additionalData || {};
        const settings = additionalData.ideSettings || {};
        if (value === 'theia') {
            delete settings.defaultIde;
        } else {
            settings.defaultIde = value;
        }
        additionalData.ideSettings = settings;
        await getGitpodService().server.updateLoggedInUser({ additionalData });
        setDefaultIde(value);
    }

    return <div>
        <SettingsPage title='Preferences' subtitle='Configure your Default IDE for all workspaces.'>
            <h3>Default IDE</h3>
            <p className="text-base">Choose which IDE you want to use.</p>
            <div className="mt-4 space-x-4 flex">
                <SelectableCard className="w-36 h-40" title="VS Code" selected={defaultIde === 'code'} onClick={() => actuallySetDefaultIde('code')}>
                    <div className="flex-grow flex justify-center align-center">
                        <img className="w-16 filter-grayscale" src="/images/vscode.svg"/>
                    </div>
                </SelectableCard>
                <SelectableCard className="w-36 h-40" title="Theia" selected={defaultIde === 'theia'} onClick={() => actuallySetDefaultIde('theia')}>
                    <div className="flex-grow flex justify-center align-center">
                        <img className="w-16" src="/images/theia-gray.svg"/>
                    </div>
                </SelectableCard>
                <SelectableCard className={`w-36 h-40 ${hasIDESettingsPermissions ? '' : 'invisible'}`} title="Custom" selected={!['code', 'theia'].includes(defaultIde)} onClick={() => setDefaultIde('')}></SelectableCard>
            </div>
            <div className={`mt-4`}>
                <label className={hasIDESettingsPermissions && !['code', 'theia'].includes(defaultIde) ? 'opacity-100' : 'opacity-0'}>
                    <p className="text-base text-gray-600 font-bold leading-5">Custom IDE image name</p>
                    <input className="w-80 mt-1" type="text" value={defaultIde} onChange={(e) => setDefaultIde(e.target.value)} onBlur={(e) => actuallySetDefaultIde(e.target.value)} />
                </label>
            </div>
        </SettingsPage>
    </div>;
}