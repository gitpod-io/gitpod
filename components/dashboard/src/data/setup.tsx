/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { get, set, del } from "idb-keyval";
import {
    PersistedClient,
    Persister,
    PersistQueryClientProvider,
    PersistQueryClientProviderProps,
} from "@tanstack/react-query-persist-client";
import { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { FunctionComponent } from "react";

// This is used to version the cache
// If data we cache changes in a non-backwards compatible way, increment this version
// That will bust any previous cache versions a client may have stored
const CACHE_VERSION = "1";

export const setupQueryClientProvider = () => {
    const client = new QueryClient();
    const queryClientPersister = createIDBPersister();

    const persistOptions: PersistQueryClientProviderProps["persistOptions"] = {
        persister: queryClientPersister,
        // This allows the client to persist up to 24 hours
        // Individual queries may expire prior to this though
        maxAge: 1000 * 60 * 60 * 24, // 24 hours
        buster: CACHE_VERSION,
    };

    // Return a wrapper around PersistQueryClientProvider w/ the query client options we setp
    const GitpodQueryClientProvider: FunctionComponent = ({ children }) => {
        return (
            <PersistQueryClientProvider client={client} persistOptions={persistOptions}>
                {children}
                <ReactQueryDevtools initialIsOpen={false} />
            </PersistQueryClientProvider>
        );
    };

    return GitpodQueryClientProvider;
};

// Persister that uses IndexedDB
function createIDBPersister(idbValidKey: IDBValidKey = "gitpodQueryClient") {
    // Track a flag that indicates if we're attempting to persist the client
    // Some browsers/versions don't support using indexed-db w/ certain settings or in private mode
    // If we get an error performing an operation, we'll disable persistance and assume it's not supported
    let persistanceActive = true;

    return {
        persistClient: async (client: PersistedClient) => {
            if (!persistanceActive) {
                return;
            }

            try {
                await set(idbValidKey, client);
            } catch (e) {
                console.error("unable to persist query client");
                persistanceActive = false;
            }
        },
        restoreClient: async () => {
            try {
                const client = await get<PersistedClient>(idbValidKey);
                return client;
            } catch (e) {
                console.error("unable to load query client from cache");
                persistanceActive = false;
            }
        },
        removeClient: async () => {
            try {
                await del(idbValidKey);
            } catch (e) {
                console.error("unable to remove query client");
                persistanceActive = false;
            }
        },
    } as Persister;
}
