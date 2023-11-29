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
// Need to import all the protobuf classes we want to support for hydration
import * as OrganizationClasses from "@gitpod/public-api/lib/gitpod/v1/organization_pb";
import * as WorkspaceClasses from "@gitpod/public-api/lib/gitpod/v1/workspace_pb";
import * as PaginationClasses from "@gitpod/public-api/lib/gitpod/v1/pagination_pb";
import * as ConfigurationClasses from "@gitpod/public-api/lib/gitpod/v1/configuration_pb";
import * as AuthProviderClasses from "@gitpod/public-api/lib/gitpod/v1/authprovider_pb";
import * as EnvVarClasses from "@gitpod/public-api/lib/gitpod/v1/envvar_pb";
import * as PrebuildClasses from "@gitpod/public-api/lib/gitpod/v1/prebuild_pb";
import * as VerificationClasses from "@gitpod/public-api/lib/gitpod/v1/verification_pb";
import * as SCMClasses from "@gitpod/public-api/lib/gitpod/v1/scm_pb";
import * as SSHClasses from "@gitpod/public-api/lib/gitpod/v1/ssh_pb";

// This is used to version the cache
// If data we cache changes in a non-backwards compatible way, increment this version
// That will bust any previous cache versions a client may have stored
const CACHE_VERSION = "10";

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
                refetchOnWindowFocus: false,
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
        ...Object.values(OrganizationClasses),
        ...Object.values(WorkspaceClasses),
        ...Object.values(PaginationClasses),
        ...Object.values(ConfigurationClasses),
        ...Object.values(AuthProviderClasses),
        ...Object.values(EnvVarClasses),
        ...Object.values(PrebuildClasses),
        ...Object.values(VerificationClasses),
        ...Object.values(SCMClasses),
        ...Object.values(SSHClasses),
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

// This is used to hydrate protobuf messages from the cache
// Serialized protobuf messages follow the format: |messageName|jsonstring
export function hydrate(value: any): any {
    if (value instanceof Array) {
        return value.map(hydrate);
    }
    if (typeof value === "string" && value.startsWith("|") && value.lastIndexOf("|") > 1) {
        // Remove the leading |
        const trimmedVal = value.substring(1);
        // Find the first | after the leading | to get the message name
        const separatorIdx = trimmedVal.indexOf("|");
        const messageName = trimmedVal.substring(0, separatorIdx);
        const json = trimmedVal.substring(separatorIdx + 1);
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
