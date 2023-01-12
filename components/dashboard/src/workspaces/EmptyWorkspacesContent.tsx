/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useContext } from "react";
import { StartWorkspaceModalContext, StartWorkspaceModalKeyBinding } from "./start-workspace-modal-context";

export const EmptyWorkspacesContent = () => {
    const { setStartWorkspaceModalProps } = useContext(StartWorkspaceModalContext);

    return (
        <div className="app-container flex flex-col space-y-2">
            <div className="px-6 py-3 flex flex-col text-gray-400 border-t border-gray-200 dark:border-gray-800">
                <div className="flex flex-col items-center justify-center h-96 w-96 mx-auto">
                    <>
                        <h3 className="text-center pb-3 text-gray-500 dark:text-gray-400">No Workspaces</h3>
                        <div className="text-center pb-6 text-gray-500">
                            Prefix any Git repository URL with {window.location.host}/# or create a new workspace for a
                            recently used project.{" "}
                            <a
                                className="gp-link"
                                target="_blank"
                                rel="noreferrer"
                                href="https://www.gitpod.io/docs/getting-started/"
                            >
                                Learn more
                            </a>
                        </div>
                        <span>
                            <button onClick={() => setStartWorkspaceModalProps({})}>
                                New Workspace{" "}
                                <span className="opacity-60 hidden md:inline">{StartWorkspaceModalKeyBinding}</span>
                            </button>
                        </span>
                    </>
                </div>
            </div>
        </div>
    );
};
