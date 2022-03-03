/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { User } from '@gitpod/gitpod-protocol';
import React, { useContext, useEffect, useState } from 'react';
import { getGitpodService } from '../service/service';
import { UserContext } from '../user-context';

type SearchResult = string;
type SearchData = SearchResult[];

const LOCAL_STORAGE_KEY = 'open-in-gitpod-search-data';
const MAX_DISPLAYED_ITEMS = 20;

export default function RepositoryFinder(props: { initialQuery?: string }) {
    const { user } = useContext(UserContext);
    const [searchQuery, setSearchQuery] = useState<string>(props.initialQuery || '');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [selectedSearchResult, setSelectedSearchResult] = useState<SearchResult | undefined>();

    const onResults = (results: SearchResult[]) => {
        if (JSON.stringify(results) !== JSON.stringify(searchResults)) {
            setSearchResults(results);
            setSelectedSearchResult(results[0]);
        }
    };

    const search = async (query: string) => {
        setSearchQuery(query);
        await findResults(query, onResults);
        if (await refreshSearchData(query, user)) {
            // Re-run search if the underlying search data has changed
            await findResults(query, onResults);
        }
    };

    useEffect(() => {
        search('');
    }, []);

    // Up/Down keyboard navigation between results
    const onKeyDown = (event: React.KeyboardEvent) => {
        if (!selectedSearchResult) {
            return;
        }
        const selectedIndex = searchResults.indexOf(selectedSearchResult);
        const select = (index: number) => {
            // Implement a true modulus in order to "wrap around" (e.g. `select(-1)` should select the last result)
            // Source: https://stackoverflow.com/a/4467559/3461173
            const n = Math.min(searchResults.length, MAX_DISPLAYED_ITEMS);
            setSelectedSearchResult(searchResults[((index % n) + n) % n]);
        };
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            select(selectedIndex + 1);
            return;
        }
        if (event.key === 'ArrowUp') {
            event.preventDefault();
            select(selectedIndex - 1);
            return;
        }
    };

    useEffect(() => {
        const element = document.querySelector(`a[href='/#${selectedSearchResult}']`);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [selectedSearchResult]);

    const onSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (selectedSearchResult) {
            window.location.href = '/#' + selectedSearchResult;
        }
    };

    return (
        <form onSubmit={onSubmit}>
            <div className="flex px-4 rounded-xl border border-gray-300 dark:border-gray-500">
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
                    className="flex-grow"
                    placeholder="Paste repository URL or type to find suggestions"
                    autoFocus
                    value={searchQuery}
                    onChange={(e) => search(e.target.value)}
                    onKeyDown={onKeyDown}
                />
            </div>
            <div className="mt-3 -mx-5 px-5 flex flex-col space-y-2 h-64 overflow-y-auto">
                {searchResults.slice(0, MAX_DISPLAYED_ITEMS).map((result, index) => (
                    <a
                        className={
                            `px-4 py-3 rounded-xl` +
                            (result === selectedSearchResult ? ' bg-gray-600 text-gray-50 dark:bg-gray-700' : '')
                        }
                        href={`/#${result}`}
                        key={`search-result-${index}`}
                        onMouseEnter={() => setSelectedSearchResult(result)}
                    >
                        {searchQuery.length < 2 ? (
                            <span>{result}</span>
                        ) : (
                            result.split(searchQuery).map((segment, index) => (
                                <span>
                                    {index === 0 ? <></> : <strong>{searchQuery}</strong>}
                                    {segment}
                                </span>
                            ))
                        )}
                    </a>
                ))}
                {searchResults.length > MAX_DISPLAYED_ITEMS && (
                    <span className="mt-3 px-4 py-2 text-sm text-gray-400 dark:text-gray-500">
                        {searchResults.length - MAX_DISPLAYED_ITEMS} more result
                        {searchResults.length - MAX_DISPLAYED_ITEMS === 1 ? '' : 's'} found
                    </span>
                )}
            </div>
        </form>
    );
}

function loadSearchData(): SearchData {
    const string = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!string) {
        return [];
    }
    try {
        const data = JSON.parse(string);
        return data;
    } catch (error) {
        console.warn('Could not load search data from local storage', error);
        return [];
    }
}

function saveSearchData(searchData: SearchData): void {
    try {
        window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(searchData));
    } catch (error) {
        console.warn('Could not save search data into local storage', error);
    }
}

let refreshSearchDataPromise: Promise<boolean> | undefined;
export async function refreshSearchData(query: string, user: User | undefined): Promise<boolean> {
    if (refreshSearchDataPromise) {
        // Another refresh is already in progress, no need to run another one in parallel.
        return refreshSearchDataPromise;
    }
    refreshSearchDataPromise = actuallyRefreshSearchData(query, user);
    const didChange = await refreshSearchDataPromise;
    refreshSearchDataPromise = undefined;
    return didChange;
}

// Fetch all possible search results and cache them into local storage
async function actuallyRefreshSearchData(query: string, user: User | undefined): Promise<boolean> {
    console.log('refreshing search data');
    const oldData = loadSearchData();
    const newData = await getGitpodService().server.getSuggestedContextURLs();
    if (JSON.stringify(oldData) !== JSON.stringify(newData)) {
        console.log('new data:', newData);
        saveSearchData(newData);
        return true;
    }
    return false;
}

async function findResults(query: string, onResults: (results: string[]) => void) {
    const searchData = loadSearchData();
    try {
        // If the query is a URL, and it's not present in the proposed results, "artificially" add it here.
        new URL(query);
        if (!searchData.includes(query)) {
            searchData.push(query);
        }
    } catch {}
    // console.log('searching', query, 'in', searchData);
    onResults(searchData.filter((result) => result.toLowerCase().includes(query.toLowerCase())));
}
