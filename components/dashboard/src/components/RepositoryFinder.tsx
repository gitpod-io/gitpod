/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useCallback, useEffect, useState } from "react";
import { getGitpodService } from "../service/service";
import { DropDown2, DropDown2Element, DropDown2SelectedElement } from "./DropDown2";
import Repository from "../icons/Repository.svg";

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
    const [suggestedContextURLs, setSuggestedContextURLs] = useState<string[]>(loadSearchData());
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
            const result = [...suggestedContextURLs];
            searchString = searchString.trim();
            try {
                // If the searchString is a URL, and it's not present in the proposed results, "artificially" add it here.
                new URL(searchString);
                if (!result.includes(searchString)) {
                    result.push(searchString);
                }
            } catch {}
            return result
                .filter((e) => e.toLowerCase().indexOf(searchString.toLowerCase()) !== -1)
                .map(
                    (e) =>
                        ({
                            id: e,
                            element: (
                                <div className="flex-col ml-1 mt-1 flex-grow">
                                    <div className="flex">
                                        <div className="text-gray-700 dark:text-gray-300 font-semibold">
                                            {stripOffProtocol(e)}
                                        </div>
                                        <div className="ml-1 text-gray-400">{}</div>
                                    </div>
                                    <div className="flex text-xs text-gray-400">{}</div>
                                </div>
                            ),
                            isSelectable: true,
                        } as DropDown2Element),
                );
        },
        [suggestedContextURLs],
    );

    const element = (
        <DropDown2SelectedElement
            iconSrc={Repository}
            htmlTitle={displayContextUrl(props.initialValue) || "Repository"}
            title={
                <div className="truncate w-80">{displayContextUrl(props.initialValue) || "Select a repository"}</div>
            }
            subtitle="Context URL"
            loading={props.loading}
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
