/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, useCallback, useMemo, useState } from "react";
import { Combobox, ComboboxElement, ComboboxSelectedItem } from "./podkit/combobox/Combobox";
import RepositorySVG from "../icons/Repository.svg";
import { ReactComponent as RepositoryIcon } from "../icons/RepositoryWithColor.svg";
import { SuggestedRepository } from "@gitpod/gitpod-protocol";
import { MiddleDot } from "./typography/MiddleDot";
import { useUnifiedRepositorySearch } from "../data/git-providers/unified-repositories-search-query";

interface RepositoryFinderProps {
    selectedContextURL?: string;
    selectedProjectID?: string;
    disabled?: boolean;
    expanded?: boolean;
    excludeProjects?: boolean;
    onChange?: (repo: SuggestedRepository) => void;
}

export default function RepositoryFinder({
    selectedContextURL,
    selectedProjectID,
    disabled,
    expanded,
    excludeProjects = false,
    onChange,
}: RepositoryFinderProps) {
    const [searchString, setSearchString] = useState("");
    const { data: repos, isLoading, isSearching } = useUnifiedRepositorySearch({ searchString, excludeProjects });

    const handleSelectionChange = useCallback(
        (selectedID: string) => {
            // selectedId is either projectId or repo url
            const matchingSuggestion = repos?.find((repo) => {
                if (repo.projectId) {
                    return repo.projectId === selectedID;
                }

                return repo.url === selectedID;
            });
            if (matchingSuggestion) {
                onChange?.(matchingSuggestion);
                return;
            }

            onChange?.({
                url: selectedID,
            });
        },
        [onChange, repos],
    );

    // Resolve the selected context url & project id props to a suggestion entry
    const selectedSuggestion = useMemo(() => {
        let match = repos?.find((repo) => {
            if (selectedProjectID) {
                return repo.projectId === selectedProjectID;
            }

            return repo.url === selectedContextURL;
        });

        // If no match, it's a context url that was typed/pasted in, so treat it like a suggestion w/ just a url
        if (!match && selectedContextURL) {
            match = {
                url: selectedContextURL,
            };
        }

        // This means we found a matching project, but the context url is different
        // user may be using a pr or branch url, so we want to make sure and use that w/ the matching project
        if (match && match.projectId && selectedContextURL && match.url !== selectedContextURL) {
            match = {
                ...match,
                url: selectedContextURL,
            };
        }

        return match;
    }, [repos, selectedContextURL, selectedProjectID]);

    const getElements = useCallback(
        // searchString ignore here as list is already pre-filtered against it
        // w/ mirrored state via useUnifiedRepositorySearch
        (searchString: string) => {
            return repos.map((repo) => {
                return {
                    id: repo.projectId || repo.url,
                    element: <SuggestedRepositoryOption repo={repo} />,
                    isSelectable: true,
                } as ComboboxElement;
            });
        },
        [repos],
    );

    return (
        <Combobox
            getElements={getElements}
            expanded={expanded}
            // we use this to track the search string so we can search for repos via the api and filter in useUnifiedRepositorySearch
            onSelectionChange={handleSelectionChange}
            disabled={disabled}
            // Only consider the isLoading prop if we're including projects in list
            loading={isLoading || isSearching}
            searchPlaceholder="Paste repository URL or type to find suggestions"
            onSearchChange={setSearchString}
        >
            <ComboboxSelectedItem
                icon={RepositorySVG}
                htmlTitle={displayContextUrl(selectedContextURL) || "Repository"}
                title={
                    <div className="truncate">
                        {displayContextUrl(
                            selectedSuggestion?.projectName ||
                                selectedSuggestion?.repositoryName ||
                                selectedSuggestion?.url,
                        ) || "Select a repository"}
                    </div>
                }
                subtitle={
                    // Only show the url if we have a project or repo name, otherwise it's redundant w/ the title
                    selectedSuggestion?.projectName || selectedSuggestion?.repositoryName
                        ? displayContextUrl(selectedSuggestion?.url)
                        : undefined
                }
                loading={isLoading}
            />
        </Combobox>
    );
}

type SuggestedRepositoryOptionProps = {
    repo: SuggestedRepository;
};
const SuggestedRepositoryOption: FC<SuggestedRepositoryOptionProps> = ({ repo }) => {
    const name = repo.projectName || repo.repositoryName;

    return (
        <div
            className="flex flex-row items-center overflow-hidden"
            aria-label={`${repo.projectId ? "Project" : "Repo"}: ${repo.url}`}
        >
            <span className={"pr-2"}>
                <RepositoryIcon className={`w-5 h-5 text-gray-400`} />
            </span>

            {name && (
                <>
                    <span className="text-sm whitespace-nowrap font-semibold">{name}</span>
                    <MiddleDot className="px-0.5 text-gray-300 dark:text-gray-500" />
                </>
            )}

            <span className="text-sm whitespace-nowrap truncate overflow-ellipsis text-gray-500 dark:text-gray-400">
                {stripOffProtocol(repo.url)}
            </span>
        </div>
    );
};

function displayContextUrl(contextUrl?: string) {
    if (!contextUrl) {
        return undefined;
    }
    return stripOffProtocol(contextUrl);
}

function stripOffProtocol(url: string): string {
    if (!url.startsWith("http")) {
        return url;
    }
    return url.substring(url.indexOf("//") + 2);
}
