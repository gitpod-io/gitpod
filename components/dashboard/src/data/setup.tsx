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
import { QueryCache, QueryClient, QueryKey } from "@tanstack/react-query";
import { Message } from "@bufbuild/protobuf";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { FunctionComponent } from "react";
import debounce from "lodash.debounce";

// This is used to version the cache
// If data we cache changes in a non-backwards compatible way, increment this version
// That will bust any previous cache versions a client may have stored
const CACHE_VERSION = "2";

export function noPersistence(queryKey: QueryKey): QueryKey {
    return [...queryKey, "no-persistence"];
}
export function isNoPersistence(queryKey: QueryKey): boolean {
    return queryKey.some((e) => e === "no-persistence");
}

export const setupQueryClientProvider = () => {
    const client = new QueryClient({
        defaultOptions: {
            queries: {
                // Default stale time to help avoid re-fetching data too frequently
                staleTime: 1000 * 5, // 5 seconds
            },
        },
        queryCache: new QueryCache({
            // log any errors our queries throw
            onError: (error) => {
                console.error(error);
            },
        }),
    });
    const queryClientPersister = createIDBPersister();

    const persistOptions: PersistQueryClientProviderProps["persistOptions"] = {
        persister: queryClientPersister,
        // This allows the client to persist up to 24 hours
        // Individual queries may expire prior to this though
        maxAge: 1000 * 60 * 60 * 24, // 24 hours
        buster: CACHE_VERSION,
        dehydrateOptions: {
            shouldDehydrateQuery: (query) => {
                return !isNoPersistence(query.queryKey) && query.state.status === "success";
            },
        },
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
export function createIDBPersister(idbValidKey: IDBValidKey = "gitpodQueryClient"): Persister {
    // Track a flag that indicates if we're attempting to persist the client
    // Some browsers/versions don't support using indexed-db w/ certain settings or in private mode
    // If we get an error performing an operation, we'll disable persistance and assume it's not supported
    let persistanceActive = true;

    // Ensure we don't persist the client too frequently
    // Important to debounce (not throttle) this so we aren't queuing up a bunch of writes
    // but instead, only persist the latest state
    const debouncedSet = debounce(
        async (client: PersistedClient) => {
            await set(idbValidKey, dehydrate(client));
        },
        500,
        {
            leading: true,
            // important so we always persist the latest state when debouncing calls
            trailing: true,
            // ensure
            maxWait: 1000,
        },
    );

    return {
        persistClient: async (client: PersistedClient) => {
            if (!persistanceActive) {
                return;
            }

            try {
                await debouncedSet(client);
            } catch (e) {
                console.error("unable to persist query client");
                persistanceActive = false;
            }
        },
        restoreClient: async () => {
            try {
                const client = await get<PersistedClient>(idbValidKey);
                hydrate(client);
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
    };
}

const supportedMessages = new Map<string, typeof Message>();

function initializeMessages() {
    const constr = [
        ...Object.values(require("@gitpod/public-api/lib/gitpod/v1/organization_pb")),
        ...Object.values(require("@gitpod/public-api/lib/gitpod/v1/workspace_pb")),
        ...Object.values(require("@gitpod/public-api/lib/gitpod/v1/pagination_pb")),
    ];
    for (const c of constr) {
        if ((c as any).prototype instanceof Message) {
            supportedMessages.set((c as any).typeName, c as typeof Message);
        }
    }
}
initializeMessages();

export function dehydrate(message: any): any {
    if (message instanceof Array) {
        return message.map(dehydrate);
    }
    if (message instanceof Message) {
        // store the constuctor index so we can deserialize it later
        return "|" + (message.constructor as any).typeName + "|" + message.toJsonString();
    }
    if (message instanceof Object) {
        const result: any = {};
        for (const key in message) {
            result[key] = dehydrate(message[key]);
        }
        return result;
    }
    return message;
}

export function hydrate(value: any): any {
    if (value instanceof Array) {
        return value.map(hydrate);
    }
    if (typeof value === "string" && value.startsWith("|") && value.lastIndexOf("|") > 1) {
        const separatorIdx = value.lastIndexOf("|");
        const messageName = value.substring(1, separatorIdx);
        const json = value.substring(separatorIdx + 1);
        const constructor = supportedMessages.get(messageName);
        if (!constructor) {
            console.error("unsupported message type", messageName);
            return value;
        }
        return (constructor as any).fromJsonString(json);
    }
    if (value instanceof Object) {
        for (const key in value) {
            value[key] = hydrate(value[key]);
        }
    }
    return value;
}
