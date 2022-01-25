/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { useContext } from "react";
import Modal from "../components/Modal";
import RepositoryFinder from "../components/RepositoryFinder";
import { StartWorkspaceModalContext } from "./start-workspace-modal-context";

export function StartWorkspaceModal() {
    const { isStartWorkspaceModalVisible, setIsStartWorkspaceModalVisible } = useContext(StartWorkspaceModalContext);

    return <Modal onClose={() => setIsStartWorkspaceModalVisible(false)} onEnter={() => false} visible={!!isStartWorkspaceModalVisible}>
        <h3 className="pb-2">New Workspace</h3>
        <div className="border-t border-gray-200 dark:border-gray-800 mt-2 -mx-6 px-6 pt-4">
            <h4 className="text-base">Search or paste a repository URL</h4>
            <RepositoryFinder />
        </div>
    </Modal>;
}
