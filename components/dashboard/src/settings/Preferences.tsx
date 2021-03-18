import { useContext, useState } from "react";
import OptionCard from "../components/OptionCard";
import { UserContext } from "../user-context";
import { SettingsPage } from "./SettingsPage";

export default function Preferences() {
    const { user } = useContext(UserContext);
    const [ defaultIde, setDefaultIde ] = useState<string>(user?.additionalData?.ideSettings?.defaultIde || 'code');

    return <div>
        <SettingsPage title='Preferences' subtitle='Configure your Default IDE for all workspaces.'>
            <h3>Default IDE</h3>
            <p className="text-base">Gitpod is using Code as the default IDE.</p>
            <div className="mt-4 space-x-4 flex">
                <OptionCard className="w-36 h-40" title="VS Code" selected={defaultIde === 'code'} onClick={()=>setDefaultIde('code')}>
                    <div className="flex-grow flex justify-center align-center">
                        <img className="w-16" src="/images/vscode.svg"/>
                    </div>
                </OptionCard>
                <OptionCard className="w-36 h-40" title="Theia" selected={defaultIde === 'theia'} onClick={()=>setDefaultIde('theia')}>
                    <div className="flex-grow flex justify-center align-center">
                        <img className="w-16" src="/images/theia.svg"/>
                    </div>
                </OptionCard>
                <OptionCard className="w-36 h-40" title="Custom" selected={!['code', 'theia'].includes(defaultIde)} onClick={()=>setDefaultIde('')}></OptionCard>
            </div>
            <div className="mt-4">
                <label className={['code', 'theia'].includes(defaultIde) ? 'opacity-0' : 'opacity-100'}>
                    <p className="text-base text-gray-600 font-bold leading-5">Custom IDE image name</p>
                    <input className="w-80 mt-1" type="text" />
                </label>
            </div>
        </SettingsPage>
    </div>;
}