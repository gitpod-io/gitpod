/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, useCallback, useEffect, useMemo, useState } from "react";
import { getGitpodService } from "../service/service";
import { DropDown2, DropDown2Element, DropDown2SelectedElement } from "./DropDown2";
import RepositorySVG from "../icons/Repository.svg";
import { ReactComponent as RepositoryIcon } from "../icons/RepositoryWithColor.svg";
import { useSuggestedRepositories } from "../data/git-providers/suggested-repositories-query";
import { useFeatureFlag } from "../data/featureflag-query";
import { SuggestedRepository } from "@gitpod/gitpod-protocol";
import { MiddleDot } from "./typography/MiddleDot";

// TODO: Remove this once we've fully enabled `includeProjectsOnCreateWorkspace`
// flag (caches w/ react-query instead of local storage)
const LOCAL_STORAGE_KEY = "open-in-gitpod-search-data";

interface RepositoryFinderProps {
    selectedContextURL?: string;
    selectedProjectID?: string;
    maxDisplayItems?: number;
    setSelection: (repoUrl: string, projectID?: string) => void;
    onError?: (error: string) => void;
    disabled?: boolean;
    loading?: boolean;
}

export default function RepositoryFinder(props: RepositoryFinderProps) {
    const includeProjectsOnCreateWorkspace = useFeatureFlag("includeProjectsOnCreateWorkspace");

    const [suggestedContextURLs, setSuggestedContextURLs] = useState<string[]>(loadSearchData());
    const { data: suggestedRepos, isLoading } = useSuggestedRepositories();

    // TODO: remove this once includeProjectsOnCreateWorkspace is fully enabled
    const suggestedRepoURLs = useMemo(() => {
        // If the flag is disabled continue to use suggestedContextURLs, but convert into SuggestedRepository objects
        if (!includeProjectsOnCreateWorkspace) {
            return suggestedContextURLs.map(
                (url): SuggestedRepository => ({
                    url,
                }),
            );
        }

        return suggestedRepos || [];
    }, [suggestedContextURLs, suggestedRepos, includeProjectsOnCreateWorkspace]);

    // TODO: remove this once includeProjectsOnCreateWorkspace is fully enabled
    useEffect(() => {
        getGitpodService()
            .server.getSuggestedContextURLs()
            .then((urls) => {
                setSuggestedContextURLs(urls);
                saveSearchData(urls);
            });
    }, []);

    const handleSelectionChange = useCallback(
        (selectedID: string) => {
            // selectedId is either projectId or repo url
            const matchingSuggestion = suggestedRepos?.find((repo) => {
                if (repo.projectId) {
                    return repo.projectId === selectedID;
                }

                return repo.url === selectedID;
            });
            if (matchingSuggestion) {
                props.setSelection(matchingSuggestion.url, matchingSuggestion.projectId);
                return;
            }

            // If we have no matching suggestion, it's a context URL they typed/pasted in, so just use that as the url
            props.setSelection(selectedID);
        },
        [props, suggestedRepos],
    );

    // Resolve the selected context url & project id props to a suggestion entry
    const selectedSuggestion = useMemo(() => {
        let match = suggestedRepos?.find((repo) => {
            if (props.selectedProjectID) {
                return repo.projectId === props.selectedProjectID;
            }

            return repo.url === props.selectedContextURL;
        });

        // If no match, it's a context url that was typed/pasted in, so treat it like a suggestion w/ just a url
        if (!match && props.selectedContextURL) {
            match = {
                url: props.selectedContextURL,
            };
        }

        // This means we found a matching project, but the context url is different
        // user may be using a pr or branch url, so we want to make sure and use that w/ the matching project
        if (match && match.projectId && props.selectedContextURL && match.url !== props.selectedContextURL) {
            match = {
                ...match,
                url: props.selectedContextURL,
            };
        }

        return match;
    }, [props.selectedProjectID, props.selectedContextURL, suggestedRepos]);

    const getElements = useCallback(
        (searchString: string) => {
            const results = filterRepos(searchString, suggestedRepoURLs);

            // With the flag off, we only want to show the suggestedContextURLs
            if (!includeProjectsOnCreateWorkspace) {
                return results.map(
                    (repo) =>
                        ({
                            id: repo.url,
                            element: (
                                <div className="flex-col ml-1 mt-1 flex-grow">
                                    <div className="flex">
                                        <div className="text-gray-700 dark:text-gray-300 font-semibold">
                                            {stripOffProtocol(repo.url)}
                                        </div>
                                        <div className="ml-1 text-gray-400">{}</div>
                                    </div>
                                    <div className="flex text-xs text-gray-400">{}</div>
                                </div>
                            ),
                            isSelectable: true,
                        } as DropDown2Element),
                );
            }

            // Otherwise we show the suggestedRepos
            return results.map((repo) => {
                return {
                    id: repo.projectId || repo.url,
                    element: <SuggestedRepositoryOption repo={repo} />,
                    isSelectable: true,
                } as DropDown2Element;
            });
        },
        [includeProjectsOnCreateWorkspace, suggestedRepoURLs],
    );

    return (
        <DropDown2
            getElements={getElements}
            expanded={!props.selectedContextURL}
            onSelectionChange={handleSelectionChange}
            disabled={props.disabled}
            loading={props.loading || isLoading}
            searchPlaceholder="Paste repository URL or type to find suggestions"
        >
            <DropDown2SelectedElement
                icon={RepositorySVG}
                htmlTitle={displayContextUrl(props.selectedContextURL) || "Repository"}
                title={
                    <div className="truncate w-80">
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
                loading={props.loading || isLoading}
            />
        </DropDown2>
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
                <RepositoryIcon className={"w-5 h-5 text-gray-400"} />
            </span>

            {name && (
                <>
                    <span className="text-sm whitespace-nowrap font-semibold">{name}</span>
                    <MiddleDot className="px-0.5 text-gray-300 dark:text-gray-500" />
                </>
            )}

            {/* TODO: refine some Text* components a bit to make it easy to set the right colors for dark/light mode */}
            <span className="text-xs whitespace-nowrap truncate overflow-ellipsis text-gray-400 dark:text-gray-400">
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

function loadSearchData(): string[] {
    const string = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!string) {
        return [];
    }
    try {
        const data = JSON.parse(string);
        return data;
    } catch (error) {
        console.warn("Could not load search data from local storage", error);
        return [];
    }
}

function saveSearchData(searchData: string[]): void {
    try {
        window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(searchData));
    } catch (error) {
        console.warn("Could not save search data into local storage", error);
    }
}

function filterRepos(searchString: string, suggestedRepos: SuggestedRepository[]) {
    let results = suggestedRepos;
    const normalizedSearchString = searchString.trim().toLowerCase();

    if (normalizedSearchString.length > 1) {
        results = suggestedRepos.filter((r) => {
            return `${r.url}${r.projectName || ""}`.toLowerCase().includes(normalizedSearchString);
        });

        if (results.length === 0) {
            try {
                // If the normalizedSearchString is a URL, and it's not present in the proposed results, "artificially" add it here.
                new URL(normalizedSearchString);
                results.push({ url: normalizedSearchString });
            } catch {}
        }
    }

    // Limit what we show to 200 results
    return results.length > 200 ? results.slice(0, 200) : results;
}

function stripOffProtocol(url: string): string {
    if (!url.startsWith("http")) {
        return url;
    }
    return url.substring(url.indexOf("//") + 2);
}
