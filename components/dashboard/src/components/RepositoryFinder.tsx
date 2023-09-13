/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { getGitpodService } from "../service/service";
import { DropDown2, DropDown2Element, DropDown2SelectedElement } from "./DropDown2";
import Repository from "../icons/Repository.svg";
import { ReactComponent as RepositoryIcon } from "../icons/RepositoryWithColor.svg";
import { useSuggestedRepositories } from "../data/git-providers/suggested-repositories-query";
import { useFeatureFlag } from "../data/featureflag-query";
import { SuggestedRepository } from "@gitpod/gitpod-protocol";
import { TextLight } from "./typography/text";
import classNames from "classnames";
import { MiddleDot } from "./typography/MiddleDot";

const LOCAL_STORAGE_KEY = "open-in-gitpod-search-data";

interface RepositoryFinderProps {
    initialValue?: string;
    maxDisplayItems?: number;
    setSelection?: (selection: string) => void;
    onError?: (error: string) => void;
    disabled?: boolean;
    loading?: boolean;
}

function stripOffProtocol(url: string): string {
    if (!url.startsWith("http")) {
        return url;
    }
    return url.substring(url.indexOf("//") + 2);
}

export default function RepositoryFinder(props: RepositoryFinderProps) {
    const includeProjectsOnCreateWorkspace = useFeatureFlag("includeProjectsOnCreateWorkspace");

    const [suggestedContextURLs, setSuggestedContextURLs] = useState<string[]>(loadSearchData());
    const { data: suggestedRepos, isLoading } = useSuggestedRepositories();

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

    useEffect(() => {
        getGitpodService()
            .server.getSuggestedContextURLs()
            .then((urls) => {
                setSuggestedContextURLs(urls);
                saveSearchData(urls);
            });
    }, []);

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
                const name = repo.projectName || repo.repositoryName;

                return {
                    id: repo.url,
                    element: (
                        <div className="flex flex-row items-center overflow-hidden">
                            <span className={"pr-3"}>
                                <RepositoryIcon
                                    className={classNames(
                                        "w-5 h-5 text-orange-500",
                                        !repo.projectId && "filter-grayscale",
                                    )}
                                />
                            </span>

                            {name && <span className="text-sm whitespace-nowrap font-semibold">{name}</span>}

                            {/* TODO: would be nice to have an easy way to set text colors here instead of wrapping w/ text */}
                            <TextLight>
                                <MiddleDot className="px-0.5" />
                            </TextLight>

                            {/* TODO: determine if Text component is helpful */}
                            <TextLight className="text-xs whitespace-nowrap truncate overflow-ellipsis">
                                {stripOffProtocol(repo.url)}
                            </TextLight>
                        </div>
                    ),
                    isSelectable: true,
                } as DropDown2Element;
            });
        },
        [includeProjectsOnCreateWorkspace, suggestedRepoURLs],
    );

    const element = (
        <DropDown2SelectedElement
            iconSrc={Repository}
            htmlTitle={displayContextUrl(props.initialValue) || "Repository"}
            title={
                <div className="truncate w-80">{displayContextUrl(props.initialValue) || "Select a repository"}</div>
            }
            subtitle="Context URL"
            loading={props.loading || isLoading}
        />
    );

    if (!props.setSelection) {
        // readonly display value
        return <div className="m-2">{element}</div>;
    }

    return (
        <DropDown2
            getElements={getElements}
            expanded={!props.initialValue}
            onSelectionChange={props.setSelection}
            disabled={props.disabled}
            loading={props.loading || isLoading}
            searchPlaceholder="Paste repository URL or type to find suggestions"
        >
            {element}
        </DropDown2>
    );
}

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
