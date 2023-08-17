/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC } from "react";
import SearchImg from "../../icons/search.svg";

type Props = {
    searchFilter: string;
    onSearchFilterChange: (value: string) => void;
};
export const NewProjectSearchInput: FC<Props> = ({ searchFilter, onSearchFilterChange }) => {
    return (
        <div className="w-full relative h-10 my-auto">
            <img
                src={SearchImg}
                title="Search"
                className="filter-grayscale absolute top-1/3 left-3"
                alt="search icon"
            />
            <input
                className="w-96 pl-10 border-0"
                type="search"
                placeholder="Search Repositories"
                value={searchFilter}
                onChange={(e) => onSearchFilterChange(e.target.value)}
            ></input>
        </div>
    );
};
