/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

export type PrebuildRateLimiters = { [cloneURL: string]: PrebuildRateLimiterConfig } & {
    "*": PrebuildRateLimiterConfig;
};

export type PrebuildRateLimiterConfig = {
    // maximum number of requests per period
    limit: number;

    // time period which the limit is enforce against in seconds
    period: number;
};

export namespace PrebuildRateLimiterConfig {
    const DEFAULT_CONFIG: PrebuildRateLimiterConfig = {
        limit: 50,
        period: 50,
    };

    export function getConfigForCloneURL(
        rateLimiters: PrebuildRateLimiters,
        cloneURL: string,
    ): PrebuildRateLimiterConfig {
        // First we use any explicit overrides for a given cloneURL
        let config = rateLimiters[cloneURL];
        if (config) {
            return config;
        }

        // Find if there is a default value set under the '*' key
        config = rateLimiters["*"];
        if (config) {
            return config;
        }

        // Last resort default
        return DEFAULT_CONFIG;
    }
}
