/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { RequestOptions } from "bitbucket/src/plugins/register-endpoints/types";

// For some reason we can't import HTTPError from bitbucket/src/error/types. This is only a subset of the actual class
export abstract class HTTPError extends Error {
    public request: RequestOptions | undefined;
}

export function handleBitbucketError(err: Error): Error {
    if (err.name !== "HTTPError") {
        return err;
    }

    const httpError = err as HTTPError;
    if (httpError.request?.headers.authorization) {
        httpError.request.headers.authorization = "<redacted>";
    }

    return httpError;
}
