/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { StartOptions } from "@gitpod/gitpod-protocol/lib/util/gitpod-host-url";
import { useCallback, useContext, useEffect, useState } from "react";
import { useLocation } from "react-router";
import Modal from "../components/Modal";
import RepositoryFinder from "../components/RepositoryFinder";
import SelectIDEComponent from "../components/SelectIDEComponent";
import SelectWorkspaceClassComponent from "../components/SelectWorkspaceClassComponent";
import { UserContext } from "../user-context";
import { StartWorkspaceModalContext } from "./start-workspace-modal-context";

export function StartWorkspaceModal() {
    const { user } = useContext(UserContext);
    const { isStartWorkspaceModalVisible, setIsStartWorkspaceModalVisible } = useContext(StartWorkspaceModalContext);
    const location = useLocation();
    const [useLatestIde, setUseLatestIde] = useState<boolean | undefined>(
        !!user?.additionalData?.ideSettings?.useLatestVersion,
    );
    const [selectedIde, setSelectedIde] = useState(user?.additionalData?.ideSettings?.defaultIde);
    const [selectedWsClass, setSelectedWsClass] = useState<string | undefined>();
    const [repo, setRepo] = useState<string | undefined>(undefined);
    const onSelectEditorChange = useCallback(
        (ide: string, useLatest: boolean) => {
            setSelectedIde(ide);
            setUseLatestIde(useLatest);
        },
        [setSelectedIde, setUseLatestIde],
    );

    const startWorkspace = useCallback(() => {
        if (!repo) {
            return false;
        }
        const url = new URL(window.location.href);
        url.pathname = "";
        const searchParams = new URLSearchParams();
        if (selectedWsClass) {
            searchParams.set(StartOptions.WORKSPACE_CLASS, selectedWsClass);
        }
        if (selectedIde) {
            searchParams.set(StartOptions.EDITOR, selectedIde);
            searchParams.set(StartOptions.USE_LATEST_EDITOR, useLatestIde ? "true" : "false");
        }
        url.search = searchParams.toString();
        url.hash = "#" + repo;
        window.location.href = url.toString();
        return true;
    }, [repo, selectedIde, selectedWsClass, useLatestIde]);

    // Close the modal on navigation events.
    useEffect(() => {
        setIsStartWorkspaceModalVisible(false);
    }, [location, setIsStartWorkspaceModalVisible]);

    useEffect(() => {
        // reset state when visibility changes.
        setSelectedIde(user?.additionalData?.ideSettings?.defaultIde);
        setUseLatestIde(!!user?.additionalData?.ideSettings?.useLatestVersion);
        setRepo(undefined);
    }, [user, setSelectedIde, setUseLatestIde, isStartWorkspaceModalVisible]);

    return (
        <Modal
            onClose={() => setIsStartWorkspaceModalVisible(false)}
            onEnter={startWorkspace}
            visible={!!isStartWorkspaceModalVisible}
            title="Open in Gitpod"
            buttons={[
                <button key="cancel" className="secondary" onClick={() => setIsStartWorkspaceModalVisible(false)}>
                    Cancel
                </button>,
                <button key="start" className="" onClick={startWorkspace} disabled={!repo || repo.length === 0}>
                    New Workspace
                </button>,
            ]}
        >
            <div className="-mx-6 px-6">
                <div className="text-xs text-gray-500">Select a repository and configure workspace options.</div>
                <div className="pt-3">
                    <RepositoryFinder setSelection={setRepo} initialValue={repo} />
                </div>
                <div className="pt-3">
                    <SelectIDEComponent
                        onSelectionChange={onSelectEditorChange}
                        selectedIdeOption={selectedIde}
                        useLatest={useLatestIde}
                    />
                </div>
                <div className="pt-3">
                    <SelectWorkspaceClassComponent
                        onSelectionChange={setSelectedWsClass}
                        selectedWorkspaceClass={selectedWsClass}
                    />
                </div>
            </div>
        </Modal>
    );
}
