import { FC } from "react";
import search from "../icons/search.svg";

type EnvironmentVariablesSearchBarProps = {
    searchTerm: string;
    onSearchTermUpdated(s: string): void;
};

const EnvironmentVariablesSearchBar: FC<EnvironmentVariablesSearchBarProps> = ({
	searchTerm, 
	onSearchTermUpdated
}) => {
	return (
		<div className="app-container py-2 flex">
            <div className="flex relative h-10 my-auto">
                <img src={search} title="Search" className="filter-grayscale absolute top-3 left-3" alt="search icon" />
                <input
                    type="search"
                    className="w-128 pl-9 border-0"
                    placeholder="use '/' to filter using repo name"
                    value={searchTerm}
                    onChange={(v) => {
                        onSearchTermUpdated(v.target.value);
                    }}
                />
            </div>
        </div>
	);
};

export default EnvironmentVariablesSearchBar;