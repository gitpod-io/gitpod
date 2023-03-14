/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useContext, useEffect, useState } from "react";
import { getGitpodService } from "../service/service";
import { UserContext } from "../user-context";
import CheckBox from "../components/CheckBox";
import { User } from "@gitpod/gitpod-protocol";
import SelectIDEComponent from "../components/SelectIDEComponent";

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
        // eslint-disable-next-line react-hooks/exhaustive-deps
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

    return (
        <>
            <SelectIDEComponent
                onSelectionChange={async (ide) => {
                    await actuallySetDefaultIde(ide);
                }}
                selectedIdeOption={defaultIde}
                useLatest={useLatestVersion}
            />
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
