/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { useContext, useState } from "react";
import CheckBox from "../components/CheckBox";
import CodeText from "../components/CodeText";
import InfoBox from "../components/InfoBox";
import { PageWithSubMenu } from "../components/PageWithSubMenu";
import PillLabel from "../components/PillLabel";
import SelectableCard from "../components/SelectableCard";
import Tooltip from "../components/Tooltip";
import golandLogo from '../images/golandLogo.svg';
import ideaLogo from '../images/intellijIdeaLogo.svg';
import vscode from '../images/vscode.svg';
import { getGitpodService } from "../service/service";
import { ThemeContext } from "../theme-context";
import { UserContext } from "../user-context";
import settingsMenu from "./settings-menu";

type Theme = 'light' | 'dark' | 'system';

export default function Preferences() {
    const { user } = useContext(UserContext);
    const { setIsDark } = useContext(ThemeContext);

    const [defaultIde, setDefaultIde] = useState<string>(user?.additionalData?.ideSettings?.defaultIde || 'code');
    const actuallySetDefaultIde = async (value: string) => {
        const additionalData = user?.additionalData || {};
        const settings = additionalData.ideSettings || {};
        settings.defaultIde = value;
        additionalData.ideSettings = settings;
        await getGitpodService().server.updateLoggedInUser({ additionalData });
        setDefaultIde(value);
    }

    const [defaultDesktopIde, setDefaultDesktopIde] = useState<string>(user?.additionalData?.ideSettings?.defaultDesktopIde || 'intellij');
    const actuallySetDefaultDesktopIde = async (value: string) => {
        const additionalData = user?.additionalData || {};
        const settings = additionalData.ideSettings || {};
        settings.defaultDesktopIde = value;
        additionalData.ideSettings = settings;
        await getGitpodService().server.updateLoggedInUser({ additionalData });
        setDefaultDesktopIde(value);
    }

    const [useDesktopIde, setUseDesktopIde] = useState<boolean>(user?.additionalData?.ideSettings?.useDesktopIde || false);
    const actuallySetUseDesktopIde = async (value: boolean) => {
        const additionalData = user?.additionalData || {};
        const settings = additionalData.ideSettings || {};
        settings.useDesktopIde = value;
        // Make sure that default desktop IDE is set even when the user did not explicitly select one.
        settings.defaultDesktopIde = defaultDesktopIde;
        additionalData.ideSettings = settings;
        await getGitpodService().server.updateLoggedInUser({ additionalData });
        setUseDesktopIde(value);
    }

    const [theme, setTheme] = useState<Theme>(localStorage.theme || 'system');
    const actuallySetTheme = (theme: Theme) => {
        if (theme === 'dark' || theme === 'light') {
            localStorage.theme = theme;
        } else {
            localStorage.removeItem('theme');
        }
        const isDark = localStorage.theme === 'dark' || (localStorage.theme !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        setIsDark(isDark);
        setTheme(theme);
    }

    return <div>
        <PageWithSubMenu subMenu={settingsMenu} title='Preferences' subtitle='Configure user preferences.'>
            <h3>Default IDE</h3>
            <p className="text-base text-gray-500">Choose which IDE you want to use.</p>
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
                        <PillLabel type="warn" className="font-semibold mt-2 py-0.5 px-2 self-center">Insiders</PillLabel>
                    </SelectableCard>
                </Tooltip>
            </div>
            <div className="mt-4 space-x-4 flex">
                <CheckBox
                    title="Open in Desktop IDE"
                    desc="Choose whether you would like to open your workspace in a desktop IDE instead."
                    checked={useDesktopIde}
                    onChange={(evt) => actuallySetUseDesktopIde(evt.target.checked)} />
            </div>
            {useDesktopIde && <>
                <div className="mt-4 space-x-4 flex">
                    <SelectableCard className="w-36 h-40" title="IntelliJ IDEA" selected={defaultDesktopIde === 'intellij'} onClick={() => actuallySetDefaultDesktopIde('intellij')}>
                        <div className="flex justify-center mt-3">
                            <img className="w-16 filter-grayscale self-center" src={ideaLogo} />
                        </div>
                        <PillLabel type="warn" className="font-semibold mt-2 py-0.5 px-2 self-center">Beta</PillLabel>
                    </SelectableCard>
                    <SelectableCard className="w-36 h-40" title="GoLand" selected={defaultDesktopIde === 'goland'} onClick={() => actuallySetDefaultDesktopIde('goland')}>
                        <div className="flex justify-center mt-3">
                            <img className="w-16 filter-grayscale self-center" src={golandLogo} />
                        </div>
                        <PillLabel type="warn" className="font-semibold mt-2 py-0.5 px-2 self-center">Beta</PillLabel>
                    </SelectableCard>
                </div>
                <InfoBox className="my-5">While in beta, when you open a workspace using a JetBrains IDE you will need to use the following password: <CodeText>gitpod</CodeText></InfoBox>
                <p className="text-left w-full text-gray-500">
                    The <strong>JetBrains desktop IDEs</strong> are currently in beta. <a href="https://github.com/gitpod-io/gitpod/issues/6576" target="gitpod-feedback-issue" rel="noopener" className="gp-link">Send feedback</a> · <a href="https://www.gitpod.io/docs/integrations/jetbrains" target="_blank" rel="noopener" className="gp-link">Documentation</a>
                </p>
            </>}
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