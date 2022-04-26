/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { IDEOption, IDEOptions } from "@gitpod/gitpod-protocol/lib/ide-protocol";
import { useContext, useEffect, useState } from "react";
import InfoBox from "../components/InfoBox";
import SelectableCardSolid from "../components/SelectableCardSolid";
import Tooltip from "../components/Tooltip";
import { getGitpodService } from "../service/service";
import { UserContext } from "../user-context";
import CheckBox from "../components/CheckBox";
import { IDESettings, User } from "@gitpod/gitpod-protocol";

export enum DisplayMode {
    List = 1,
    Cell,
}

export interface SelectIDEProps {
    showLatest?: boolean;
    onChange?: (ide: string, useLatest: boolean) => void;
    displayMode?: DisplayMode;
}

export default function SelectIDE(props: SelectIDEProps) {
    const { showLatest = true, displayMode = DisplayMode.Cell } = props;

    const { user: originUser, setUser } = useContext(UserContext);
    const user: User = JSON.parse(JSON.stringify(originUser));

    const migrationIDESettings = () => {
        if (!user?.additionalData?.ideSettings || user.additionalData.ideSettings.settingVersion === "2.0") {
            return;
        }
        const newIDESettings: IDESettings = {
            settingVersion: "2.0",
        };
        const ideSettings = user.additionalData.ideSettings;
        if (ideSettings.useDesktopIde) {
            if (ideSettings.defaultDesktopIde === "code-desktop") {
                newIDESettings.defaultIde = "code-desktop";
            } else if (ideSettings.defaultDesktopIde === "code-desktop-insiders") {
                newIDESettings.defaultIde = "code-desktop";
                newIDESettings.useLatestVersion = true;
            } else {
                newIDESettings.defaultIde = ideSettings.defaultDesktopIde;
                newIDESettings.useLatestVersion = ideSettings.useLatestVersion;
            }
        } else {
            const useLatest = ideSettings.defaultIde === "code-latest";
            newIDESettings.defaultIde = "code";
            newIDESettings.useLatestVersion = useLatest;
        }
        user.additionalData.ideSettings = newIDESettings;
    };
    migrationIDESettings();

    const updateUserIDEInfo = async (selectedIde: string, useLatestVersion: boolean) => {
        const additionalData = user?.additionalData ?? {};
        const settings = additionalData.ideSettings ?? {};
        settings.settingVersion = "2.0";
        settings.defaultIde = selectedIde;
        settings.useLatestVersion = useLatestVersion;
        additionalData.ideSettings = settings;
        getGitpodService()
            .server.trackEvent({
                event: "ide_configuration_changed",
                properties: settings,
            })
            .then()
            .catch(console.error);
        props.onChange && props.onChange(selectedIde, useLatestVersion);
        const newUser = await getGitpodService().server.updateLoggedInUser({ additionalData });
        setUser({ ...newUser });
    };

    const [defaultIde, setDefaultIde] = useState<string>(user?.additionalData?.ideSettings?.defaultIde || "");
    const actuallySetDefaultIde = async (value: string) => {
        // force context to refresh
        // setUser({ ...user! });
        await updateUserIDEInfo(value, useLatestVersion);
        setDefaultIde(value);
    };

    const [useLatestVersion, setUseLatestVersion] = useState<boolean>(
        user?.additionalData?.ideSettings?.useLatestVersion ?? false,
    );
    const actuallySetUseLatestVersion = async (value: boolean) => {
        await updateUserIDEInfo(defaultIde, value);
        setUseLatestVersion(value);
    };

    const [ideOptions, setIdeOptions] = useState<IDEOptions | undefined>(undefined);
    useEffect(() => {
        (async () => {
            const ideopts = await getGitpodService().server.getIDEOptions();
            // TODO: Compatible with ide-config not deployed, need revert after ide-config deployed
            delete ideopts.options["code-latest"];
            delete ideopts.options["code-desktop-insiders"];

            setIdeOptions(ideopts);
        })();
    }, []);

    const allIdeOptions = ideOptions && orderedIdeOptions(ideOptions);
    const displayList = displayMode === DisplayMode.List;

    return (
        <>
            {ideOptions && (
                <>
                    {allIdeOptions && (
                        <>
                            <div className={`my-4  flex flex-wrap max-w-2xl ${displayList ? "gap-2" : "gap-4"}`}>
                                {allIdeOptions.map(([id, option]) => {
                                    const selected = defaultIde === id;
                                    console.log(id, defaultIde, selected);
                                    const onSelect = () => actuallySetDefaultIde(id);
                                    return renderIdeOption(option, selected, onSelect, displayMode);
                                })}
                            </div>
                            {ideOptions.options[defaultIde]?.notes && (
                                <InfoBox className="my-5 max-w-2xl">
                                    <ul>
                                        {ideOptions.options[defaultIde].notes?.map((x, idx) => (
                                            <li className={idx > 0 ? "mt-2" : ""}>{x}</li>
                                        ))}
                                    </ul>
                                </InfoBox>
                            )}
                            <p className="text-left w-full text-gray-500">
                                The <strong>JetBrains desktop IDEs</strong> are currently in beta.{" "}
                                <a
                                    href="https://github.com/gitpod-io/gitpod/issues/6576"
                                    target="gitpod-feedback-issue"
                                    rel="noopener"
                                    className="gp-link whitespace-nowrap"
                                >
                                    Send Feedback
                                </a>{" "}
                                ·{" "}
                                <a
                                    href="https://www.gitpod.io/docs/integrations/jetbrains"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="gp-link"
                                >
                                    Documentation
                                </a>
                            </p>
                        </>
                    )}
                    {showLatest && (
                        <CheckBox
                            title="Latest Release (Unstable)"
                            desc={
                                <span>
                                    Use the latest version for each editor.{" "}
                                    <a
                                        className="gp-link"
                                        target="_blank"
                                        href="https://code.visualstudio.com/blogs/2016/02/01/introducing_insiders_build"
                                    >
                                        Insiders
                                    </a>{" "}
                                    for VS Code,{" "}
                                    <a
                                        className="gp-link"
                                        target="_blank"
                                        href="https://www.jetbrains.com/resources/eap/"
                                    >
                                        EAP
                                    </a>{" "}
                                    for JetBrains IDEs.
                                </span>
                            }
                            checked={useLatestVersion}
                            onChange={(e) => actuallySetUseLatestVersion(e.target.checked)}
                        />
                    )}
                </>
            )}
        </>
    );
}

function orderedIdeOptions(ideOptions: IDEOptions) {
    // TODO: Maybe convert orderKey to number before sort?
    return Object.entries(ideOptions.options)
        .filter(([_, x]) => !x.hidden)
        .sort((a, b) => {
            const keyA = a[1].orderKey || a[0];
            const keyB = b[1].orderKey || b[0];
            return keyA.localeCompare(keyB);
        });
}

function renderIdeOption(
    option: IDEOption,
    selected: boolean,
    onSelect: () => void,
    displayMode: DisplayMode,
): JSX.Element {
    const label = option.type === "desktop" ? "" : option.type;
    const displayList = displayMode === DisplayMode.List;
    const card = (
        <SelectableCardSolid
            className={`${displayList ? "h-12 w-full flex flex-row flex-nowrap" : "w-36 h-40 flex flex-col"}`}
            title={option.title}
            selected={selected}
            onClick={onSelect}
        >
            <div
                className={`w-full text-base font-semibold truncate ${displayList ? "order-2" : ""} ${
                    selected ? "text-gray-100 dark:text-gray-600" : "text-gray-600 dark:text-gray-500"
                }`}
                title={option.title}
            >
                {option.title}
            </div>
            <div className={`justify-center ${displayList ? "inline-flex order-1 mx-2 flex-none" : "flex mt-3"}`}>
                <img
                    className={`filter-grayscale self-center ${displayList ? "w-5" : "w-16"}`}
                    src={option.logo}
                    alt="logo"
                />
            </div>
            {label ? (
                <div
                    className={`font-semibold text-sm uppercase px-3 py-1 self-center ${
                        displayList ? "order-3" : "mt-2"
                    } ${selected ? "text-gray-100 dark:text-gray-600" : "text-gray-600 dark:text-gray-500"}`}
                >
                    {label}
                </div>
            ) : (
                <></>
            )}
        </SelectableCardSolid>
    );

    if (option.tooltip) {
        return <Tooltip content={option.tooltip}>{card}</Tooltip>;
    }
    return card;
}
