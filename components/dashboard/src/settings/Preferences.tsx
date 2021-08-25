/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { useContext, useState } from "react";
import { getGitpodService } from "../service/service";
import SelectableCard from "../components/SelectableCard";
import { UserContext } from "../user-context";
import { ThemeContext } from "../theme-context";
import theia from '../images/theia-gray.svg';
import vscode from '../images/vscode.svg';
import { PageWithSubMenu } from "../components/PageWithSubMenu";
import settingsMenu from "./settings-menu";
import AlertBox from "../components/AlertBox";
import Tooltip from "../components/Tooltip";

type Theme = 'light' | 'dark' | 'system';

export default function Preferences() {
    const { user } = useContext(UserContext);
    const { setIsDark } = useContext(ThemeContext);
    const [defaultIde, setDefaultIde] = useState<string>(user?.additionalData?.ideSettings?.defaultIde || 'theia');
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
    const [theme, setTheme] = useState<Theme>(localStorage.theme || 'light');
    const actuallySetTheme = (theme: Theme) => {
        if (theme === 'dark' || theme === 'system') {
            localStorage.theme = theme;
        } else {
            localStorage.removeItem('theme');
        }
        const isDark = localStorage.theme === 'dark' || (localStorage.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        setIsDark(isDark);
        setTheme(theme);
    }

    return <div>
        <PageWithSubMenu subMenu={settingsMenu} title='Preferences' subtitle='Configure user preferences.'>
            <h3>Default IDE</h3>
            <p className="text-base text-gray-500">Choose which IDE you want to use.</p>
            <AlertBox className="mt-3 mb-4 w-3/4">
                We're deprecating the Theia editor. You can still switch back to Theia for the next few weeks but the preference will be removed by the end of August 2021.
            </AlertBox>
            <div className="mt-4 space-x-4 flex">
                <SelectableCard className="w-36 h-40" title="VS Code" selected={defaultIde === 'code'} onClick={() => actuallySetDefaultIde('code')}>
                    <div className="flex justify-center mt-3">
                        <img className="w-16 filter-grayscale self-center" src={vscode} />
                    </div>
                </SelectableCard>
                <Tooltip content={'Early access version, still subject to testing.'} >
                    <SelectableCard className="w-36 h-40" title="VS Code" selected={defaultIde === 'code-latest'} onClick={() => actuallySetDefaultIde('code-latest')}>
                        <div className="flex justify-center mt-3">
                            <img className="w-16 filter-grayscale self-center" src={vscode} />
                        </div>
                        <span className="mt-2 ml-2 self-center rounded-xl py-0.5 px-2 text-sm bg-orange-100 text-orange-700 dark:bg-orange-600 dark:text-orange-100 font-semibold">LATEST</span>
                    </SelectableCard>
                </Tooltip>
                <SelectableCard className="w-36 h-40" title="Theia" selected={defaultIde === 'theia'} onClick={() => actuallySetDefaultIde('theia')}>
                    <div className="flex justify-center mt-3">
                        <img className="w-16 h-16 dark:filter-invert self-center" src={theia} />
                    </div>
                </SelectableCard>
            </div>
            <h3 className="mt-12">Theme</h3>
            <p className="text-base text-gray-500">Early bird or night owl? Choose your side.</p>
            <div className="mt-4 space-x-4 flex">
                <SelectableCard className="w-36 h-32" title="Light" selected={theme === 'light'} onClick={() => actuallySetTheme('light')}>
                    <div className="flex-grow flex justify-center items-end">
                        <svg className="h-16" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 108 64"><rect width="68" height="40" x="40" fill="#C4C4C4" rx="8" /><rect width="32" height="16" fill="#C4C4C4" rx="8" /><rect width="32" height="16" y="24" fill="#C4C4C4" rx="8" /><rect width="32" height="16" y="48" fill="#C4C4C4" rx="8" /></svg>
                    </div>
                </SelectableCard>
                <SelectableCard className="w-36 h-32" title="Dark" selected={theme === 'dark'} onClick={() => actuallySetTheme('dark')}>
                    <div className="flex-grow flex justify-center items-end">
                        <svg className="h-16" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 108 64"><rect width="68" height="40" x="40" fill="#737373" rx="8" /><rect width="32" height="16" fill="#737373" rx="8" /><rect width="32" height="16" y="24" fill="#737373" rx="8" /><rect width="32" height="16" y="48" fill="#737373" rx="8" /></svg>
                    </div>
                </SelectableCard>
                <SelectableCard className="w-36 h-32" title="System" selected={theme === 'system'} onClick={() => actuallySetTheme('system')}>
                    <div className="flex-grow flex justify-center items-end">
                        <svg className="h-16" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 108 64"><rect width="68" height="40" x="40" fill="#C4C4C4" rx="8" /><path fill="#737373" d="M74.111 3.412A8 8 0 0180.665 0H100a8 8 0 018 8v24a8 8 0 01-8 8H48.5L74.111 3.412z" /><rect width="32" height="16" fill="#C4C4C4" rx="8" /><rect width="32" height="16" y="24" fill="#737373" rx="8" /><rect width="32" height="16" y="48" fill="#C4C4C4" rx="8" /></svg>
                    </div>
                </SelectableCard>
            </div>
        </PageWithSubMenu>
    </div>;
}