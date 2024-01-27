/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { IRateLimiterOptions } from "rate-limiter-flexible";

const RATE_LIMIT_METADATA_KEY = Symbol("RateLimited");

export function RateLimited(options: IRateLimiterOptions) {
    return Reflect.metadata(RATE_LIMIT_METADATA_KEY, options);
}

export namespace RateLimited {
    export const defaultOptions: IRateLimiterOptions = {
        points: 200,
        duration: 60,
    };
    export function getOptions(target: Object, properyKey: string | symbol): IRateLimiterOptions {
        return Reflect.getMetadata(RATE_LIMIT_METADATA_KEY, target, properyKey) || defaultOptions;
    }
}
