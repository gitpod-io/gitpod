/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { useContext, useState } from "react";
import { getGitpodService } from "../service/service";
import SelectableCard from "../components/SelectableCard";
import { UserContext } from "../user-context";
import { SettingsPage } from "./SettingsPage";
import * as images from '../images';

export default function Preferences() {
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
        <SettingsPage title='Preferences' subtitle='Configure user preferences.'>
            <h3>Default IDE</h3>
            <p className="text-base">Choose which IDE you want to use.</p>
            <div className="mt-4 space-x-4 flex">
                <SelectableCard className="w-36 h-40" title="VS Code" selected={defaultIde === 'code'} onClick={() => actuallySetDefaultIde('code')}>
                    <div className="flex-grow flex justify-center align-center">
                        <img className="w-16 filter-grayscale" src={images.vscode}/>
                    </div>
                </SelectableCard>
                <SelectableCard className="w-36 h-40" title="Theia" selected={defaultIde === 'theia'} onClick={() => actuallySetDefaultIde('theia')}>
                    <div className="flex-grow flex justify-center align-center">
                        <img className="w-16" src={images.theia}/>
                    </div>
                </SelectableCard>
            </div>
        </SettingsPage>
    </div>;
}