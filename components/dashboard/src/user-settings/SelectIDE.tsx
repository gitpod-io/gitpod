/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { User } from "@gitpod/gitpod-protocol";
import { IDEOptions } from "@gitpod/gitpod-protocol/lib/ide-protocol";
import { useCallback, useContext, useEffect, useState } from "react";
import { Button } from "../components/Button";
import CheckBox from "../components/CheckBox";
import MutableSelectIDEComponent from "../components/MutableSelectIDEComponent";
import PillLabel from "../components/PillLabel";
import { useUpdateCurrentUserMutation } from "../data/current-user/update-mutation";
import { getGitpodService } from "../service/service";
import { UserContext } from "../user-context";

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
            const newUserData = await updateUser.mutateAsync({
                additionalData: {
                    ...additionalData,
                    ideSettings: {
                        ...ideSettings,
                        settingVersion: "2.0",
                        defaultIde: selectedIde,
                        useLatestVersion: useLatestVersion,
                    },
                },
            });
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

    const [ideOptions, setIdeOptions] = useState<IDEOptions>();
    useEffect(() => {
        getGitpodService().server.getIDEOptions().then(setIdeOptions);
    }, []);

    //#region Custom Image Refs
    // TODO hide behind a feature flag
    const [customImageRef, setCustomImageRef] = useState<string>("");
    const addCustomImageRef = useCallback(
        async (e) => {
            e.preventDefault();
            // TODO verify image first with resolveEditorImage
            // show failure to the user if it doesn't work

            const additionalData = user?.additionalData || {};
            const ideSettings = additionalData.ideSettings || {};
            const customImageRefs = new Set(ideSettings.customImageRefs);
            if (customImageRef.trim()) {
                customImageRefs.add(customImageRef);
            }
            const newUserData = await updateUser.mutateAsync({
                additionalData: {
                    ...additionalData,
                    ideSettings: {
                        ...ideSettings,
                        settingVersion: "2.0",
                        defaultIde: defaultIde,
                        useLatestVersion: useLatestVersion,
                        customImageRefs: [...customImageRefs],
                    },
                },
            });
            setUser(newUserData);
            getGitpodService().server.getIDEOptions().then(setIdeOptions);
            setCustomImageRef("");

            // TODO show success message to user
        },
        [setUser, updateUser, user?.additionalData, defaultIde, useLatestVersion, customImageRef],
    );
    const removeCustomImageRef = useCallback(
        async (customImageRef: string, e) => {
            e.preventDefault();
            e.stopPropagation();

            const additionalData = user?.additionalData || {};
            const ideSettings = additionalData.ideSettings || {};
            const customImageRefs = new Set(ideSettings.customImageRefs);
            customImageRefs.delete(customImageRef);
            const newUserData = await updateUser.mutateAsync({
                additionalData: {
                    ...additionalData,
                    ideSettings: {
                        ...ideSettings,
                        settingVersion: "2.0",
                        defaultIde: defaultIde,
                        useLatestVersion: useLatestVersion,
                        customImageRefs: [...customImageRefs],
                    },
                },
            });
            setUser(newUserData);
            getGitpodService().server.getIDEOptions().then(setIdeOptions);
        },
        [setUser, updateUser, user?.additionalData, defaultIde, useLatestVersion],
    );
    //#endregion

    //todo(ft): find a better way to group IDEs by vendor
    const shouldShowJetbrainsNotice = !["code", "code-desktop"].includes(defaultIde); // a really hacky way to get just JetBrains IDEs

    return (
        <>
            <div className="w-112 max-w-full my-4">
                <MutableSelectIDEComponent
                    ideOptions={ideOptions}
                    onSelectionChange={actuallySetDefaultIde}
                    selectedIdeOption={defaultIde}
                    useLatest={useLatestVersion}
                    onDelete={removeCustomImageRef}
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

            <form className="mt-4 max-w-xl" onSubmit={addCustomImageRef}>
                <h4>Custom Editors</h4>
                <span className="flex">
                    <input
                        type="text"
                        value={customImageRef}
                        className="w-96 h-9"
                        placeholder="e.g. eu.gcr.io/gitpod-core-dev/build/ide/xterm-web:latest"
                        onChange={(e) => setCustomImageRef(e.target.value)}
                    />
                    <Button type="secondary" className="ml-2">
                        Save Changes
                    </Button>
                </span>
                <div className="mt-1">
                    <p className="text-gray-500 dark:text-gray-400">
                        Install a custom editor in your personal account.
                    </p>
                </div>
            </form>
        </>
    );
}
