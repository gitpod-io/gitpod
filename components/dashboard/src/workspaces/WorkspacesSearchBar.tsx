/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FunctionComponent, useContext } from "react";
import DropDown from "../components/DropDown";
import { StartWorkspaceModalContext, StartWorkspaceModalKeyBinding } from "./start-workspace-modal-context";

type WorkspacesSearchBarProps = {
    searchTerm: string;
    limit: number;
    onSearchTermUpdated(s: string): void;
    onLimitUpdated(limit: number): void;
};

export const WorkspacesSearchBar: FunctionComponent<WorkspacesSearchBarProps> = ({
    searchTerm,
    limit,
    onSearchTermUpdated,
    onLimitUpdated,
}) => {
    const { setStartWorkspaceModalProps } = useContext(StartWorkspaceModalContext);

    return (
        <div className="app-container py-2 flex">
            <div className="flex">
                <div className="py-4">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 16 16" width="16" height="16">
                        <path
                            fill="#A8A29E"
                            d="M6 2a4 4 0 100 8 4 4 0 000-8zM0 6a6 6 0 1110.89 3.477l4.817 4.816a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 010 6z"
                        />
                    </svg>
                </div>
                <input
                    type="search"
                    className="text-sm"
                    placeholder="Filter Workspaces"
                    value={searchTerm}
                    onChange={(v) => {
                        onSearchTermUpdated(v.target.value);
                    }}
                />
            </div>
            <div className="flex-1" />
            <div className="py-3"></div>
            <div className="py-3 pl-3">
                <DropDown
                    prefix="Limit: "
                    customClasses="w-32"
                    activeEntry={`${limit}`}
                    entries={[
                        {
                            title: "50",
                            onClick: () => {
                                onLimitUpdated(50);
                            },
                        },
                        {
                            title: "100",
                            onClick: () => {
                                onLimitUpdated(100);
                            },
                        },
                        {
                            title: "200",
                            onClick: () => {
                                onLimitUpdated(200);
                            },
                        },
                    ]}
                />
            </div>
            <button onClick={() => setStartWorkspaceModalProps({})} className="ml-2">
                New Workspace <span className="opacity-60 hidden md:inline">{StartWorkspaceModalKeyBinding}</span>
            </button>
        </div>
    );
};
