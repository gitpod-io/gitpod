/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, useCallback, useEffect, useMemo, useState } from "react";
import { Combobox, ComboboxElement, ComboboxSelectedItem } from "./podkit/combobox/Combobox";
import RepositorySVG from "../icons/Repository.svg";
import { ReactComponent as RepositoryIcon } from "../icons/RepositoryWithColor.svg";
import { MiddleDot } from "./typography/MiddleDot";
import { useUnifiedRepositorySearch } from "../data/git-providers/unified-repositories-search-query";
import { useAuthProviderDescriptions } from "../data/auth-providers/auth-provider-descriptions-query";
import { ReactComponent as Exclamation2 } from "../images/exclamation2.svg";
import { AuthProviderType } from "@gitpod/public-api/lib/gitpod/v1/authprovider_pb";
import { SuggestedRepository } from "@gitpod/public-api/lib/gitpod/v1/scm_pb";

interface RepositoryFinderProps {
    selectedContextURL?: string;
    selectedConfigurationId?: string;
    disabled?: boolean;
    expanded?: boolean;
    excludeConfigurations?: boolean;
    onlyConfigurations?: boolean;
    onChange?: (repo: SuggestedRepository) => void;
}

export default function RepositoryFinder({
    selectedContextURL,
    selectedConfigurationId,
    disabled,
    expanded,
    excludeConfigurations = false,
    onlyConfigurations = false,
    onChange,
}: RepositoryFinderProps) {
    const [searchString, setSearchString] = useState("");
    const {
        data: repos,
        isLoading,
        isSearching,
        hasMore,
    } = useUnifiedRepositorySearch({
        searchString,
        excludeConfigurations: excludeConfigurations,
        onlyConfigurations: onlyConfigurations,
    });

    const authProviders = useAuthProviderDescriptions();

    const handleSelectionChange = useCallback(
        (selectedID: string) => {
            // selectedId is either configurationId or repo url
            const matchingSuggestion = repos?.find((repo) => {
                if (repo.configurationId) {
                    return repo.configurationId === selectedID;
                }

                return repo.url === selectedID;
            });
            if (matchingSuggestion) {
                onChange?.(matchingSuggestion);
                return;
            }

            onChange?.(
                new SuggestedRepository({
                    url: selectedID,
                }),
            );
        },
        [onChange, repos],
    );

    const [selectedSuggestion, setSelectedSuggestion] = useState<SuggestedRepository | undefined>(undefined);

    // Resolve the selected context url & configurationId id props to a suggestion entry
    useEffect(() => {
        let match = repos?.find((repo) => {
            if (selectedConfigurationId) {
                return repo.configurationId === selectedConfigurationId;
            }

            return repo.url === selectedContextURL;
        });

        // If no match, it's a context url that was typed/pasted in, so treat it like a suggestion w/ just a url
        if (!match && selectedContextURL) {
            match = new SuggestedRepository({
                url: selectedContextURL,
            });
        }

        // This means we found a matching configuration, but the context url is different
        // user may be using a pr or branch url, so we want to make sure and use that w/ the matching configuration
        if (match && match.configurationId && selectedContextURL && match.url !== selectedContextURL) {
            match.url = selectedContextURL;
        }

        // Do not update the selected suggestion if it already has a name and the context url matches
        // If the configurationId changes, we want to update the selected suggestion with it
        if (selectedSuggestion) {
            const name = selectedSuggestion.configurationName || selectedSuggestion.repoName;
            if (name && selectedSuggestion.url === selectedContextURL) {
                if (selectedSuggestion.configurationId === selectedConfigurationId) {
                    return;
                }
            }
        }

        setSelectedSuggestion(match);

        // If we put the selectedSuggestion in the dependency array, it will cause an infinite loop
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [repos, selectedContextURL, selectedConfigurationId]);

    const displayName = useMemo(() => {
        if (!selectedSuggestion) {
            return;
        }

        if (!selectedSuggestion?.configurationName) {
            return displayContextUrl(selectedSuggestion?.repoName || selectedSuggestion?.url);
        }

        return selectedSuggestion?.configurationName;
    }, [selectedSuggestion]);

    const getElements = useCallback(
        // searchString ignore here as list is already pre-filtered against it
        // w/ mirrored state via useUnifiedRepositorySearch
        (searchString: string) => {
            const result = repos.map((repo) => {
                return {
                    id: repo.configurationId || repo.url,
                    element: <SuggestedRepositoryOption repo={repo} />,
                    isSelectable: true,
                } as ComboboxElement;
            });
            if (hasMore) {
                // add an element that tells the user to refine the search
                result.push({
                    id: "more",
                    element: (
                        <div className="text-sm text-pk-content-tertiary">Repo missing? Try refining your search.</div>
                    ),
                    isSelectable: false,
                } as ComboboxElement);
            }
            if (
                searchString.length >= 3 &&
                authProviders.data?.some((p) => p.type === AuthProviderType.BITBUCKET_SERVER) &&
                !onlyConfigurations
            ) {
                // add an element that tells the user that the Bitbucket Server does only support prefix search
                result.push({
                    id: "bitbucket-server",
                    element: (
                        <div className="text-sm text-pk-content-tertiary">
                            <div className="flex items-center">
                                <Exclamation2 className="w-4 h-4"></Exclamation2>
                                <span className="ml-2">Bitbucket Server only supports searching by prefix.</span>
                            </div>
                        </div>
                    ),
                    isSelectable: false,
                } as ComboboxElement);
            }
            if (searchString.length < 3) {
                // add an element that tells the user to type more
                result.push({
                    id: "not-searched",
                    element: (
                        <div className="text-sm text-pk-content-tertiary">
                            Please type at least 3 characters to search.
                        </div>
                    ),
                    isSelectable: false,
                } as ComboboxElement);
            }
            return result;
        },
        [repos, hasMore, authProviders.data, onlyConfigurations],
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
                title={<div className="truncate">{displayName || "Select a repository"}</div>}
                subtitle={
                    // Only show the url if we have a project or repo name, otherwise it's redundant w/ the title
                    selectedSuggestion?.configurationName || selectedSuggestion?.repoName
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
    const name = repo.configurationName || repo.repoName;
    const repoPath = stripOffProtocol(repo.url);

    return (
        <div
            className="flex flex-row items-center overflow-hidden"
            aria-label={`${repo.configurationId ? "Project" : "Repo"}: ${repo.url}`}
        >
            <span className={"pr-2"}>
                <RepositoryIcon className={`w-5 h-5 text-pk-content-tertiary`} />
            </span>

            {name && (
                <>
                    <span className="text-sm whitespace-nowrap font-semibold">{name}</span>
                    <MiddleDot className="px-0.5 text-pk-content-tertiary" />
                </>
            )}

            <span
                className="text-sm whitespace-nowrap truncate overflow-ellipsis text-pk-content-secondary"
                title={repoPath}
            >
                {repoPath}
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
