/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { IDEOption, IDEOptions } from "@gitpod/gitpod-protocol/lib/ide-protocol";
import { useContext, useEffect, useState } from "react";
import InfoBox from "../components/InfoBox";
import SelectableCardSolid from "../components/SelectableCardSolid";
import Tooltip from "../components/Tooltip";
import { getGitpodService } from "../service/service";
import { UserContext } from "../user-context";
import CheckBox from "../components/CheckBox";
import { User } from "@gitpod/gitpod-protocol";
import PillLabel from "../components/PillLabel";

export type IDEChangedTrackLocation = "workspace_list" | "workspace_start" | "preferences";
interface SelectIDEProps {
    updateUserContext?: boolean;
    location: IDEChangedTrackLocation;
}

export const updateUserIDEInfo = async (
    user: User,
    selectedIde: string,
    useLatestVersion: boolean,
    location: IDEChangedTrackLocation,
) => {
    const additionalData = user?.additionalData ?? {};
    const settings = additionalData.ideSettings ?? {};
    settings.settingVersion = "2.0";
    settings.defaultIde = selectedIde;
    settings.useLatestVersion = useLatestVersion;
    additionalData.ideSettings = settings;
    getGitpodService()
        .server.trackEvent({
            event: "ide_configuration_changed",
            properties: {
                ...settings,
                location,
            },
        })
        .then()
        .catch(console.error);
    return getGitpodService().server.updateLoggedInUser({ additionalData });
};

export default function SelectIDE(props: SelectIDEProps) {
    const { user, setUser } = useContext(UserContext);

    // Only exec once when we access this component
    useEffect(() => {
        user && User.migrationIDESettings(user);
    }, []);

    const actualUpdateUserIDEInfo = async (user: User, selectedIde: string, useLatestVersion: boolean) => {
        const newUserData = await updateUserIDEInfo(user, selectedIde, useLatestVersion, props.location);
        props.updateUserContext && setUser({ ...newUserData });
    };

    const [defaultIde, setDefaultIde] = useState<string>(user?.additionalData?.ideSettings?.defaultIde || "code");
    const actuallySetDefaultIde = async (value: string) => {
        await actualUpdateUserIDEInfo(user!, value, useLatestVersion);
        setDefaultIde(value);
    };

    const [useLatestVersion, setUseLatestVersion] = useState<boolean>(
        user?.additionalData?.ideSettings?.useLatestVersion ?? false,
    );
    const actuallySetUseLatestVersion = async (value: boolean) => {
        await actualUpdateUserIDEInfo(user!, defaultIde, value);
        setUseLatestVersion(value);
    };

    const [ideOptions, setIdeOptions] = useState<IDEOptions | undefined>(undefined);
    useEffect(() => {
        (async () => {
            setIdeOptions(await getGitpodService().server.getIDEOptions());
        })();
    }, []);

    const allIdeOptions = ideOptions && orderedIdeOptions(ideOptions);

    return (
        <>
            {ideOptions && (
                <>
                    {allIdeOptions && (
                        <>
                            <div className={`my-4 gap-3 flex flex-wrap max-w-3xl`}>
                                {allIdeOptions.map(([id, option]) => {
                                    const selected = defaultIde === id;
                                    const version = useLatestVersion ? option.latestImageVersion : option.imageVersion;
                                    const onSelect = () => actuallySetDefaultIde(id);
                                    return renderIdeOption(option, selected, version, onSelect);
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

                            <p className="text-left w-full text-gray-400 dark:text-gray-500">
                                <strong>JetBrains </strong> integration is currently in{" "}
                                <PillLabel type="warn" className="font-semibold mt-2 ml-0 py-0.5 px-1 self-center">
                                    <a href="https://www.gitpod.io/docs/references/gitpod-releases">
                                        <span className="text-xs">Beta</span>
                                    </a>
                                </PillLabel>
                                &nbsp;&middot;&nbsp;
                                <a
                                    href="https://github.com/gitpod-io/gitpod/issues/6576"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="gp-link"
                                >
                                    Send feedback
                                </a>
                            </p>
                        </>
                    )}
                    <CheckBox
                        title="Latest Release (Unstable)"
                        desc={
                            <span>
                                Use the latest version for each editor.{" "}
                                <a
                                    className="gp-link"
                                    target="_blank"
                                    href="https://code.visualstudio.com/blogs/2016/02/01/introducing_insiders_build"
                                    rel="noreferrer"
                                >
                                    Insiders
                                </a>{" "}
                                for VS Code,{" "}
                                <a
                                    className="gp-link"
                                    target="_blank"
                                    href="https://www.jetbrains.com/resources/eap/"
                                    rel="noreferrer"
                                >
                                    EAP
                                </a>{" "}
                                for JetBrains IDEs.
                            </span>
                        }
                        checked={useLatestVersion}
                        onChange={(e) => actuallySetUseLatestVersion(e.target.checked)}
                    />
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
    version: IDEOption["imageVersion"],
    onSelect: () => void,
): JSX.Element {
    const label = option.type === "desktop" ? "" : option.type;
    const card = (
        <SelectableCardSolid className="w-36 h-44" title={option.title} selected={selected} onClick={onSelect}>
            <div className="flex justify-center mt-3">
                <img className="w-16 filter-grayscale self-center" src={option.logo} alt="logo" />
            </div>
            <div
                className="mt-2 px-3 py-1 self-center"
                style={{
                    minHeight: "1.75rem",
                }}
            >
                {label ? (
                    <span
                        className={`font-semibold text-sm ${
                            selected ? "text-gray-100 dark:text-gray-600" : "text-gray-600 dark:text-gray-500"
                        } uppercase`}
                    >
                        {label}
                    </span>
                ) : (
                    <></>
                )}
            </div>

            {version ? (
                <div
                    className={`font-semibold text-xs ${
                        selected ? "text-gray-100 dark:text-gray-600" : "text-gray-600 dark:text-gray-500"
                    } uppercase px-3 self-center`}
                    title="The IDE's current version on Gitpod"
                >
                    {version}
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
