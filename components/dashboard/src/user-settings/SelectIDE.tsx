/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { ReactNode, useCallback, useContext, useState } from "react";
import { UserContext } from "../user-context";
import { CheckboxInputField } from "../components/forms/CheckboxInputField";
import SelectIDEComponent, { isJetbrains } from "../components/SelectIDEComponent";
import PillLabel from "../components/PillLabel";
import { useUpdateCurrentUserMutation } from "../data/current-user/update-mutation";
import { converter } from "../service/public-api";
import { isOrganizationOwned } from "@gitpod/public-api-common/lib/user-utils";
import Alert from "../components/Alert";
import { useFeatureFlag } from "../data/featureflag-query";
import { IDESettingsVersion } from "@gitpod/gitpod-protocol/lib/ide-protocol";

export type IDEChangedTrackLocation = "workspace_list" | "workspace_start" | "preferences";
interface SelectIDEProps {
    location: IDEChangedTrackLocation;
}

export default function SelectIDE(props: SelectIDEProps) {
    const { user, setUser } = useContext(UserContext);
    const updateUser = useUpdateCurrentUserMutation();

    const [defaultIde, setDefaultIde] = useState<string>(user?.editorSettings?.name || "code");
    const [useLatestVersion, setUseLatestVersion] = useState<boolean>(user?.editorSettings?.version === "latest");
    const [preferToolbox, setPreferToolbox] = useState<boolean>(user?.editorSettings?.preferToolbox || false);
    const [ideWarning, setIdeWarning] = useState<ReactNode | undefined>(undefined);
    const enableExperimentalJBTB = useFeatureFlag("enable_experimental_jbtb");

    const isOrgOwnedUser = user && isOrganizationOwned(user);

    const actualUpdateUserIDEInfo = useCallback(
        async (selectedIde: string, useLatestVersion: boolean, preferToolbox: boolean) => {
            // update stored autostart options to match useLatestVersion value set here
            const workspaceAutostartOptions = user?.workspaceAutostartOptions?.map((o) => {
                const option = converter.fromWorkspaceAutostartOption(o);

                if (option.ideSettings) {
                    option.ideSettings.useLatestVersion = useLatestVersion;
                    option.ideSettings.preferToolbox = preferToolbox;
                }

                return option;
            });

            const updatedUser = await updateUser.mutateAsync({
                additionalData: {
                    workspaceAutostartOptions,
                    ideSettings: {
                        settingVersion: IDESettingsVersion,
                        defaultIde: selectedIde,
                        useLatestVersion: useLatestVersion,
                        preferToolbox: preferToolbox,
                    },
                },
            });
            setUser(updatedUser);
        },
        [setUser, updateUser, user?.workspaceAutostartOptions],
    );

    const actuallySetDefaultIde = useCallback(
        async (value: string) => {
            await actualUpdateUserIDEInfo(value, useLatestVersion, preferToolbox);
            setDefaultIde(value);
        },
        [actualUpdateUserIDEInfo, useLatestVersion, preferToolbox],
    );

    const actuallySetUseLatestVersion = useCallback(
        async (value: boolean) => {
            await actualUpdateUserIDEInfo(defaultIde, value, preferToolbox);
            setUseLatestVersion(value);
        },
        [actualUpdateUserIDEInfo, defaultIde, preferToolbox],
    );

    const actuallySetPreferToolbox = useCallback(
        async (value: boolean) => {
            await actualUpdateUserIDEInfo(defaultIde, useLatestVersion, value);
            setPreferToolbox(value);
        },
        [actualUpdateUserIDEInfo, defaultIde, useLatestVersion],
    );

    const shouldShowJetbrainsNotice = isJetbrains(defaultIde);

    return (
        <>
            {ideWarning && (
                <Alert type="warning" className="my-2 max-w-md">
                    <span className="text-sm">{ideWarning}</span>
                </Alert>
            )}

            <div className="w-112 max-w-full my-4">
                <SelectIDEComponent
                    onSelectionChange={actuallySetDefaultIde}
                    selectedIdeOption={defaultIde}
                    useLatest={useLatestVersion}
                    setWarning={setIdeWarning}
                    ignoreRestrictionScopes={isOrgOwnedUser ? ["configuration"] : ["configuration", "organization"]}
                    hideVersions
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

            {enableExperimentalJBTB && (
                <CheckboxInputField
                    label={
                        <span className="flex items-center gap-2">
                            Launch in JetBrains Toolbox{" "}
                            <PillLabel type="warn">
                                <a href="https://www.gitpod.io/docs/references/gitpod-releases">
                                    <span className="text-xs">BETA</span>
                                </a>
                            </PillLabel>
                        </span>
                    }
                    hint={<span>Launch JetBrains IDEs in the JetBrains Toolbox.</span>}
                    checked={preferToolbox}
                    onChange={(checked) => actuallySetPreferToolbox(checked)}
                />
            )}
        </>
    );
}
