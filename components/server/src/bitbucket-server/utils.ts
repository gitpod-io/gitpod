/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { HTTPError } from "bitbucket/src/error/types";

export class BitbucketHttpError extends Error {
    status: number;
    constructor(originalErr: HTTPError, message: string) {
        if (originalErr.request?.headers.authorization) {
            originalErr.request.headers.authorization = "<redacted>";
        }
        super(message);
    }
}

export function handleBitbucketError(err: Error): Error {
    return err instanceof HTTPError ? new BitbucketHttpError(err, "Error parsing BB context") : err;
}
