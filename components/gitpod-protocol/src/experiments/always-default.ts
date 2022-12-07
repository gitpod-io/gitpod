/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */
import { Attributes, Client } from "./types";

// AlwaysReturningDefaultValueClient is an implemention of an experiments.Client which performs no lookup/network operation
// and always returns the default value for a given experimentName.
// This client is used for non-SaaS version of Gitpod, in particular for self-hosted installations where external
// network connections are not desirable or even possible.
class AlwaysReturningDefaultValueClient implements Client {
    getValueAsync<T>(experimentName: string, defaultValue: T, attributes: Attributes): Promise<T> {
        return Promise.resolve(defaultValue);
    }

    dispose(): void {
        // there is nothing to dispose, no-op.
    }
}

export function newAlwaysReturningDefaultValueClient(): Client {
    return new AlwaysReturningDefaultValueClient();
}
