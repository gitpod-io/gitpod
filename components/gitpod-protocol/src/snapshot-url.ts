/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

export interface SnapshotUrl {
    bucketId: string;
    fullPath: string;
    filename: string;
}
export namespace SnapshotUrl {
    export function parse(url: string): SnapshotUrl {
        const parts = url.split("@");
        if (parts.length !== 2) {
            throw new Error(`cannot parse snapshot URL: ${url}`);
        }
        const [fullPath, bucketId] = parts;

        const pathParts = fullPath.split("/");
        if (pathParts.length < 1) {
            throw new Error(`cannot parse snapshot URL: ${url}`);
        }
        const filename = pathParts[pathParts.length - 1];
        return { bucketId, fullPath, filename };
    }
}
