/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { injectable } from "inversify";

/**
 * A cache that can be used to cache expensive operations, such as retrieving data from the database.
 */
export interface DataCache {
    /**
     * Retrieves the value for the given key from the cache. If the value is not in the cache, the provider is called and the result is stored in the cache.
     * @param key the key to retrieve the value for. Should be segmented using `:`. For example: `user:123`
     * @param provider the provider to call if the value is not in the cache
     */
    get<T>(key: string, provider: () => Promise<T | undefined>): Promise<T | undefined>;

    /**
     * @param keyPattern the key pattern to invalidate. The `*` denotes a wildcard segment. For example: `user:*` invalidates all keys starting with `user:`
     */
    invalidate(keyPattern: string): Promise<void>;
}
export const DataCache = Symbol("DataCache");

@injectable()
export class DataCacheNoop implements DataCache {
    get<T>(key: string, provider: () => Promise<T | undefined>): Promise<T | undefined> {
        return provider();
    }

    async invalidate(partialKey: string): Promise<void> {
        // noop
    }
}
