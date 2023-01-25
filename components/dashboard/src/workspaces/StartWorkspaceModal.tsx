/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useCallback, useContext, useState } from "react";
import Modal, { ModalBody, ModalFooter, ModalHeader } from "../components/Modal";
import RepositoryFinder from "../components/RepositoryFinder";
import SelectIDEComponent from "../components/SelectIDEComponent";
import SelectWorkspaceClassComponent from "../components/SelectWorkspaceClassComponent";
import { StartWorkspaceOptions } from "../start/start-workspace-options";
import { UserContext } from "../user-context";

export interface StartWorkspaceModalProps {
    uselatestIde?: boolean;
    ide?: string;
    workspaceClass?: string;
    contextUrl?: string;
    // If contextUrl is provided, setting `allowContextUrlChange` to true will allow it to be changed still
    allowContextUrlChange?: boolean;
    onClose?: () => void;
}

export function StartWorkspaceModal(props: StartWorkspaceModalProps) {
    const { user } = useContext(UserContext);
    const [useLatestIde, setUseLatestIde] = useState<boolean | undefined>(
        props.uselatestIde || !!user?.additionalData?.ideSettings?.useLatestVersion,
    );
    const [selectedIde, setSelectedIde] = useState(props.ide || user?.additionalData?.ideSettings?.defaultIde);
    const [selectedWsClass, setSelectedWsClass] = useState<string | undefined>(props.workspaceClass);
    const [errorWsClass, setErrorWsClass] = useState<string | undefined>(undefined);
    const [repo, setRepo] = useState<string | undefined>(props.contextUrl);
    const onSelectEditorChange = useCallback(
        (ide: string, useLatest: boolean) => {
            setSelectedIde(ide);
            setUseLatestIde(useLatest);
        },
        [setSelectedIde, setUseLatestIde],
    );
    const [errorIde, setErrorIde] = useState<string | undefined>(undefined);

    const startWorkspace = useCallback(() => {
        if (!repo || errorWsClass || errorIde) {
            return false;
        }
        const url = new URL(window.location.href);
        url.pathname = "";
        url.search = StartWorkspaceOptions.toSearchParams({
            workspaceClass: selectedWsClass,
            ideSettings: {
                defaultIde: selectedIde,
                useLatestVersion: useLatestIde,
            },
        });
        url.hash = "#" + repo;
        window.location.href = url.toString();
        return true;
    }, [repo, selectedIde, selectedWsClass, useLatestIde, errorIde, errorWsClass]);

    return (
        <Modal
            onClose={props.onClose || (() => {})}
            closeable={!!props.onClose}
            onEnter={startWorkspace}
            visible={true}
        >
            <ModalHeader>Open in Gitpod</ModalHeader>
            <ModalBody noScroll>
                <div className="-mx-6 px-6">
                    <div className="text-xs text-gray-500">Start a new workspace with the following options.</div>
                    <div className="pt-3">
                        <RepositoryFinder
                            setSelection={props.contextUrl && !props.allowContextUrlChange ? undefined : setRepo}
                            initialValue={repo}
                        />
                    </div>
                    <div className="pt-3">
                        {errorIde && <div className="text-red-500 text-sm">{errorIde}</div>}
                        <SelectIDEComponent
                            onSelectionChange={onSelectEditorChange}
                            setError={setErrorIde}
                            selectedIdeOption={selectedIde}
                            useLatest={useLatestIde}
                        />
                    </div>
                    <div className="pt-3">
                        {errorWsClass && <div className="text-red-500 text-sm">{errorWsClass}</div>}
                        <SelectWorkspaceClassComponent
                            onSelectionChange={setSelectedWsClass}
                            setError={setErrorWsClass}
                            selectedWorkspaceClass={selectedWsClass}
                        />
                    </div>
                </div>
            </ModalBody>
            <ModalFooter>
                {props.onClose && (
                    <button key="cancel" className="secondary" onClick={props.onClose}>
                        Cancel
                    </button>
                )}
                <button
                    key="start"
                    className=""
                    onClick={startWorkspace}
                    disabled={!repo || repo.length === 0 || !!errorIde || !!errorWsClass}
                >
                    New Workspace
                </button>
            </ModalFooter>
        </Modal>
    );
}
