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
    const [editorImage, setEditorImage] = useState<string>("");

    const actualUpdateUserIDEInfo = useCallback(
        async (selectedIde: string, useLatestVersion: boolean, editorImage: string) => {
            const additionalData = user?.additionalData || {};
            const ideSettings = additionalData.ideSettings || {};
            const installedImages = new Set(ideSettings.installedImages);
            if (editorImage.trim()) {
                installedImages.add(editorImage);
            }
            const updates = {
                additionalData: {
                    ...additionalData,
                    ideSettings: {
                        ...ideSettings,
                        settingVersion: "2.0",
                        defaultIde: selectedIde,
                        useLatestVersion: useLatestVersion,
                        installedImages: [...installedImages],
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
            await actualUpdateUserIDEInfo(value, useLatestVersion, editorImage);
            setDefaultIde(value);
        },
        [actualUpdateUserIDEInfo, useLatestVersion, editorImage],
    );

    const actuallySetUseLatestVersion = useCallback(
        async (value: boolean) => {
            await actualUpdateUserIDEInfo(defaultIde, value, editorImage);
            setUseLatestVersion(value);
        },
        [actualUpdateUserIDEInfo, defaultIde, editorImage],
    );

    const [ideOptions, setIdeOptions] = useState<IDEOptions>();
    useEffect(() => {
        getGitpodService().server.getIDEOptions().then(setIdeOptions);
    }, []);

    // TODO hide behind a feature flag
    const saveEditorImage = useCallback(
        async (e) => {
            e.preventDefault();
            // TODO verify image first with resolveEditorImage
            await actualUpdateUserIDEInfo(defaultIde, useLatestVersion, editorImage);
            // TODO show success message
            getGitpodService().server.getIDEOptions().then(setIdeOptions);
        },
        [actualUpdateUserIDEInfo, defaultIde, useLatestVersion, editorImage],
    );

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

            <form className="mt-4 max-w-xl" onSubmit={saveEditorImage}>
                <h4>Editor Image</h4>
                <span className="flex">
                    <input
                        type="text"
                        value={editorImage}
                        className="w-96 h-9"
                        placeholder="e.g. eu.gcr.io/gitpod-core-dev/build/ide/xterm-web:latest"
                        onChange={(e) => setEditorImage(e.target.value)}
                    />
                    <Button type="secondary" className="ml-2">
                        Save Changes
                    </Button>
                </span>
                <div className="mt-1">
                    <p className="text-gray-500 dark:text-gray-400">
                        Install an editor from the image in your personal account.
                    </p>
                </div>
            </form>
        </>
    );
}
