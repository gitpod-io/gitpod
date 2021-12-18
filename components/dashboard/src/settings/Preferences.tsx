/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { IDEOption, IDEOptions } from "@gitpod/gitpod-protocol/lib/ide-protocol";
import { useContext, useEffect, useState } from "react";
import CheckBox from "../components/CheckBox";
import InfoBox from "../components/InfoBox";
import { PageWithSubMenu } from "../components/PageWithSubMenu";
import PillLabel from "../components/PillLabel";
import SelectableCard from "../components/SelectableCard";
import Tooltip from "../components/Tooltip";
import ideLogos from '../images/ideLogos';
import { getGitpodService } from "../service/service";
import { ThemeContext } from "../theme-context";
import { UserContext } from "../user-context";
import settingsMenu from "./settings-menu";

type Theme = 'light' | 'dark' | 'system';

export default function Preferences() {
    const { user } = useContext(UserContext);
    const { setIsDark } = useContext(ThemeContext);

    const [defaultIde, setDefaultIde] = useState<string>(user?.additionalData?.ideSettings?.defaultIde || "");
    const actuallySetDefaultIde = async (value: string) => {
        const additionalData = user?.additionalData || {};
        const settings = additionalData.ideSettings || {};
        settings.defaultIde = value;
        additionalData.ideSettings = settings;
        getGitpodService().server.trackEvent({
            event: "ide_configuration_changed",
            properties: {
                useDesktopIde,
                defaultIde: value,
                defaultDesktopIde: useDesktopIde ? defaultDesktopIde : undefined
            },
        });
        await getGitpodService().server.updateLoggedInUser({ additionalData });
        setDefaultIde(value);
    }

    const [defaultDesktopIde, setDefaultDesktopIde] = useState<string>(user?.additionalData?.ideSettings?.defaultDesktopIde || "");
    const actuallySetDefaultDesktopIde = async (value: string) => {
        const additionalData = user?.additionalData || {};
        const settings = additionalData.ideSettings || {};
        settings.defaultDesktopIde = value;
        additionalData.ideSettings = settings;
        getGitpodService().server.trackEvent({
            event: "ide_configuration_changed",
            properties: {
                useDesktopIde,
                defaultIde,
                defaultDesktopIde: value
            },
        });
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
        getGitpodService().server.trackEvent({
            event: "ide_configuration_changed",
            properties: {
                useDesktopIde: value,
                defaultIde,
                defaultDesktopIde: value ? defaultDesktopIde : undefined
            },
        });
        await getGitpodService().server.updateLoggedInUser({ additionalData });
        setUseDesktopIde(value);
    }

    const [ideOptions, setIdeOptions] = useState<IDEOptions | undefined>(undefined);
    useEffect(() => {
        (async () => {
            const ideopts = await getGitpodService().server.getIDEOptions();
            setIdeOptions(ideopts);
            if (!(defaultIde)) {
                setDefaultIde(ideopts.defaultIde);
            }
            if (!defaultDesktopIde) {
                setDefaultDesktopIde(ideopts.defaultDesktopIde);
            }
        })();
    }, []);

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

    const browserIdeOptions = ideOptions && orderedIdeOptions(ideOptions, "browser");
    const desktopIdeOptions = ideOptions && orderedIdeOptions(ideOptions, "desktop");

    return <div>
        <PageWithSubMenu subMenu={settingsMenu} title='Preferences' subtitle='Configure user preferences.'>
            {ideOptions && browserIdeOptions && <>
                <h3>Default IDE</h3>
                <p className="text-base text-gray-500 dark:text-gray-400">Choose which IDE you want to use.</p>
                <div className="my-4 space-x-4 flex">
                    {
                        browserIdeOptions.map(([id, option]) => {
                            const selected = defaultIde === id;
                            const onSelect = () => actuallySetDefaultIde(id);
                            return renderIdeOption(option, selected, onSelect);
                        })
                    }
                </div>
                {ideOptions.options[defaultIde].notes &&
                    <InfoBox className="my-5 max-w-2xl"><ul>
                        {ideOptions.options[defaultIde].notes?.map((x, idx) => <li className={idx > 0 ? "mt-2" : ""}>{x}</li>)}
                    </ul></InfoBox>
                }
                {desktopIdeOptions && desktopIdeOptions.length > 0 && <>
                    <div className="mt-4 space-x-4 flex">
                        <CheckBox
                            title={<div>Open in Desktop IDE <PillLabel type="warn" className="font-semibold mt-2 py-0.5 px-2 self-center">Beta</PillLabel></div>}
                            desc="Choose whether you would like to open your workspace in a desktop IDE instead."
                            checked={useDesktopIde}
                            onChange={(evt) => actuallySetUseDesktopIde(evt.target.checked)} />
                    </div>
                    {useDesktopIde && <>
                        <div className="my-4 space-x-4 flex">
                            {
                                desktopIdeOptions.map(([id, option]) => {
                                    const selected = defaultDesktopIde === id;
                                    const onSelect = () => actuallySetDefaultDesktopIde(id);
                                    return renderIdeOption(option, selected, onSelect);
                                })
                            }
                        </div>

                        {ideOptions.options[defaultDesktopIde].notes &&
                            <InfoBox className="my-5 max-w-2xl"><ul>
                                {ideOptions.options[defaultDesktopIde].notes?.map((x, idx) => <li className={idx > 0 ? "mt-2" : ""}>{x}</li>)}
                            </ul></InfoBox>
                        }
                        <p className="text-left w-full text-gray-500">
                            The <strong>JetBrains desktop IDEs</strong> are currently in beta. <a href="https://github.com/gitpod-io/gitpod/issues/6576" target="gitpod-feedback-issue" rel="noopener" className="gp-link">Send feedback</a> · <a href="https://www.gitpod.io/docs/integrations/jetbrains" target="_blank" rel="noopener noreferrer" className="gp-link">Documentation</a>
                        </p>
                    </>}
                </>}
            </>}
            <h3 className="mt-12">Theme</h3>
            <p className="text-base text-gray-500 dark:text-gray-400">Early bird or night owl? Choose your side.</p>
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

function orderedIdeOptions(ideOptions: IDEOptions, type: "browser" | "desktop") {
    return Object.entries(ideOptions.options)
        .filter(([_, x]) => x.type === type && !x.hidden)
        .sort((a, b) => {
            const keyA = a[1].orderKey || a[0];
            const keyB = b[1].orderKey || b[0];
            return keyA.localeCompare(keyB);
        });
}

function renderIdeOption(option: IDEOption, selected: boolean, onSelect: () => void): JSX.Element {
    const card = <SelectableCard className="w-36 h-40" title={option.title} selected={selected} onClick={onSelect}>
        <div className="flex justify-center mt-3">
            <img className="w-16 filter-grayscale self-center"
                src={option.logo.startsWith("http") ? option.logo : ideLogos[option.logo]} />
        </div>
        {option.label ? <div className={`font-semibold text-sm ${selected ? 'text-green-500' : 'text-gray-500 dark:text-gray-400'} uppercase mt-2 ml-2 px-3 py-1 self-center`}>{option.label}</div> : <></>}
    </SelectableCard>;

    if (option.tooltip) {
        return <Tooltip content={option.tooltip} >
            {card}
        </Tooltip>;
    }
    return card;
}
