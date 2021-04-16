/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { useContext, useState } from "react";
import { getGitpodService } from "../service/service";
import SelectableCard from "../components/SelectableCard";
import { UserContext } from "../user-context";
import theia from '../images/theia-gray.svg';
import vscode from '../images/vscode.svg';
import { PageWithSubMenu } from "../components/PageWithSubMenu";
import settingsMenu from "./settings-menu";

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
    const [ isDarkTheme, setIsDarkTheme ] = useState<boolean>(document.documentElement.classList.contains('dark'));
    const actuallySetIsDarkTheme = (is: boolean) => {
        document.documentElement.classList.toggle('dark', is);
        localStorage.theme = is ? 'dark' : 'light';
        setIsDarkTheme(is);
    }

    return <div>
        <PageWithSubMenu subMenu={settingsMenu}  title='Preferences' subtitle='Configure user preferences.'>
            <h3>Default IDE</h3>
            <p className="text-base text-gray-500">Choose which IDE you want to use.</p>
            <div className="mt-4 space-x-4 flex">
                <SelectableCard className="w-36 h-40" title="VS Code" selected={defaultIde === 'code'} onClick={() => actuallySetDefaultIde('code')}>
                    <div className="flex-grow flex justify-center align-center">
                        <img className="w-16 filter-grayscale" src={vscode}/>
                    </div>
                </SelectableCard>
                <SelectableCard className="w-36 h-40" title="Theia" selected={defaultIde === 'theia'} onClick={() => actuallySetDefaultIde('theia')}>
                    <div className="flex-grow flex justify-center align-center">
                        <img className="w-16" src={theia}/>
                    </div>
                </SelectableCard>
            </div>
            <h3 className="mt-12">Color Scheme</h3>
            <p className="text-base text-gray-500">Light or dark?</p>
            <div className="mt-4 space-x-4 flex">
                <label><input type="radio" name="theme" value="light" checked={!isDarkTheme} onChange={() => actuallySetIsDarkTheme(false)}></input> Light</label>
                <label><input type="radio" name="theme" value="dark" checked={isDarkTheme} onChange={() => actuallySetIsDarkTheme(true)}></input> Dark</label>
            </div>
        </PageWithSubMenu>
    </div>;
}