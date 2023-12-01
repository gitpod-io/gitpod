/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useCallback, useContext, useEffect, useState } from "react";
import { UserContext } from "../user-context";
import { CheckboxInputField } from "../components/forms/CheckboxInputField";
import { User } from "@gitpod/gitpod-protocol";
import SelectIDEComponent from "../components/SelectIDEComponent";
import PillLabel from "../components/PillLabel";
import { useUpdateCurrentUserMutation } from "../data/current-user/update-mutation";

export type IDEChangedTrackLocation = "workspace_list" | "workspace_start" | "preferences";
interface SelectIDEProps {
    location: IDEChangedTrackLocation;
}

export default function SelectIDE(props: SelectIDEProps) {
    const { user, setUser } = useContext(UserContext);
    const updateUser = useUpdateCurrentUserMutation();

    // Only exec once when we access this component
    useEffect(() => {
        user && User.migrationIDESettings(user);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const [defaultIde, setDefaultIde] = useState<string>(user?.additionalData?.ideSettings?.defaultIde || "code");
    const [useLatestVersion, setUseLatestVersion] = useState<boolean>(
        user?.additionalData?.ideSettings?.useLatestVersion ?? false,
    );

    const actualUpdateUserIDEInfo = useCallback(
        async (selectedIde: string, useLatestVersion: boolean) => {
            const additionalData = user?.additionalData || {};
            const ideSettings = additionalData.ideSettings || {};

            // update stored autostart options to match useLatestVersion value set here
            const workspaceAutostartOptions = additionalData?.workspaceAutostartOptions?.map((option) => {
                if (option.ideSettings) {
                    const newOption = {
                        ...option,
                        ideSettings: {
                            ...option.ideSettings,
                            useLatestVersion,
                        },
                    };
                    return newOption;
                }

                return option;
            });

            const updates = {
                additionalData: {
                    ...additionalData,
                    workspaceAutostartOptions,
                    ideSettings: {
                        ...ideSettings,
                        settingVersion: "2.0",
                        defaultIde: selectedIde,
                        useLatestVersion: useLatestVersion,
                    },
                },
            };
            const newUserData = await updateUser.mutateAsync(updates);
            setUser(newUserData);
        },
        [setUser, updateUser, user?.additionalData],
    );

    const actuallySetDefaultIde = useCallback(
        async (value: string) => {
            await actualUpdateUserIDEInfo(value, useLatestVersion);
            setDefaultIde(value);
        },
        [actualUpdateUserIDEInfo, useLatestVersion],
    );

    const actuallySetUseLatestVersion = useCallback(
        async (value: boolean) => {
            await actualUpdateUserIDEInfo(defaultIde, value);
            setUseLatestVersion(value);
        },
        [actualUpdateUserIDEInfo, defaultIde],
    );

    //todo(ft): find a better way to group IDEs by vendor
    const shouldShowJetbrainsNotice = !["code", "code-desktop", "xterm"].includes(defaultIde); // a really hacky way to get just JetBrains IDEs

    return (
        <>
            <div className="w-112 max-w-full my-4">
                <SelectIDEComponent
                    onSelectionChange={actuallySetDefaultIde}
                    selectedIdeOption={defaultIde}
                    useLatest={useLatestVersion}
                />
            </div>

            {shouldShowJetbrainsNotice && (
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
            )}

            <CheckboxInputField
                label="Latest Release (Unstable)"
                hint={
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
                onChange={(checked) => actuallySetUseLatestVersion(checked)}
            />
        </>
    );
}
