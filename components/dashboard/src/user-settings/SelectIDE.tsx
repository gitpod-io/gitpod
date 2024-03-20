/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useCallback, useContext, useState } from "react";
import { UserContext } from "../user-context";
import { CheckboxInputField } from "../components/forms/CheckboxInputField";
import SelectIDEComponent from "../components/SelectIDEComponent";
import PillLabel from "../components/PillLabel";
import { useUpdateCurrentUserMutation } from "../data/current-user/update-mutation";
import { converter } from "../service/public-api";
import { isOrganizationOwned } from "@gitpod/public-api-common/lib/user-utils";

export type IDEChangedTrackLocation = "workspace_list" | "workspace_start" | "preferences";
interface SelectIDEProps {
    location: IDEChangedTrackLocation;
}

export default function SelectIDE(props: SelectIDEProps) {
    const { user, setUser } = useContext(UserContext);
    const updateUser = useUpdateCurrentUserMutation();

    const [defaultIde, setDefaultIde] = useState<string>(user?.editorSettings?.name || "code");
    const [useLatestVersion, setUseLatestVersion] = useState<boolean>(user?.editorSettings?.version === "latest");

    const isOrgOwnedUser = user && isOrganizationOwned(user);

    const actualUpdateUserIDEInfo = useCallback(
        async (selectedIde: string, useLatestVersion: boolean) => {
            // update stored autostart options to match useLatestVersion value set here
            const workspaceAutostartOptions = user?.workspaceAutostartOptions?.map((o) => {
                const option = converter.fromWorkspaceAutostartOption(o);

                if (option.ideSettings) {
                    option.ideSettings.useLatestVersion = useLatestVersion;
                }

                return option;
            });

            const updatedUser = await updateUser.mutateAsync({
                additionalData: {
                    workspaceAutostartOptions,
                    ideSettings: {
                        settingVersion: "2.0",
                        defaultIde: selectedIde,
                        useLatestVersion: useLatestVersion,
                    },
                },
            });
            setUser(updatedUser);
        },
        [setUser, updateUser, user?.workspaceAutostartOptions],
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
                    ignoreRestrictionScopes={isOrgOwnedUser ? ["configuration"] : ["configuration", "organization"]}
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
