/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FunctionComponent } from "react";
import { Link } from "react-router-dom";
import { StartWorkspaceModalKeyBinding } from "../App";
import DropDown from "../components/DropDown";
import search from "../icons/search.svg";
import { Button } from "@podkit/buttons/Button";

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
    return (
        <div className="app-container py-2 flex">
            <div className="flex relative h-10 my-auto">
                <img src={search} title="Search" className="filter-grayscale absolute top-3 left-3" alt="search icon" />
                <input
                    type="search"
                    className="w-64 pl-9 border-0"
                    placeholder="Filter Workspaces"
                    value={searchTerm}
                    onChange={(v) => {
                        onSearchTermUpdated(v.target.value);
                    }}
                />
            </div>
            <div className="flex-1" />
            <div className="py-2"></div>
            <div className="py-2 pl-3">
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
            <Link to={"/new"}>
                <Button className="ml-2 gap-1.5 h-10">
                    New Workspace <span className="opacity-60 hidden md:inline">{StartWorkspaceModalKeyBinding}</span>
                </Button>
            </Link>
        </div>
    );
};
