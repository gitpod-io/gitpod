/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useContext, useEffect, useState } from "react";
import { UserContext } from "../user-context";
import CheckBox from "../components/CheckBox";
import { User } from "@gitpod/gitpod-protocol";
import SelectIDEComponent from "../components/SelectIDEComponent";
import PillLabel from "../components/PillLabel";
import { useUpdateCurrentUserMutation } from "../data/current-user/update-mutation";

export type IDEChangedTrackLocation = "workspace_list" | "workspace_start" | "preferences";
interface SelectIDEProps {
    updateUserContext?: boolean;
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

    const actualUpdateUserIDEInfo = async (selectedIde: string, useLatestVersion: boolean) => {
        const additionalData = user?.additionalData ?? {};
        const settings = additionalData.ideSettings ?? {};
        settings.settingVersion = "2.0";
        settings.defaultIde = selectedIde;
        settings.useLatestVersion = useLatestVersion;
        additionalData.ideSettings = settings;

        const newUserData = await updateUser.mutateAsync({ additionalData });
        props.updateUserContext && setUser({ ...newUserData });
    };

    const actuallySetDefaultIde = async (value: string) => {
        await actualUpdateUserIDEInfo(value, useLatestVersion);
        setDefaultIde(value);
    };

    const actuallySetUseLatestVersion = async (value: boolean) => {
        await actualUpdateUserIDEInfo(defaultIde, value);
        setUseLatestVersion(value);
    };

    //todo(ft): find a better way to group IDEs by vendor
    const shouldShowJetbrainsNotice = !["code", "code-desktop"].includes(defaultIde); // a really hacky way to get just JetBrains IDEs

    return (
        <>
            <div className="w-112 max-w-full my-4">
                <SelectIDEComponent
                    onSelectionChange={async (ide) => {
                        await actuallySetDefaultIde(ide);
                    }}
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
    );
}
